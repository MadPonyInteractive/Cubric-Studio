# MPI-1039 plan - camera-angle bench

## Goal
Find which local edit model turns one picture into believable new camera angles of the same
character / room, and which prompt wording does it. Bench first; a Flow only if one wins.

## Bench - STAGED (Fabio 2026-10-22: small first, widen only for what passes)
- Models (Fabio, only these): `flux3-klein` (edit, base), `klein-9b` (kleinEdit), `qwen-image-2-1` (edit, 1k).
- Stage 1 - face: one FLUX.3 t2i head-and-shoulders source (face + some chest, clothes, jewellery),
  LOPSIDED details (hoop in her left ear only, mole on right cheek, side parting) so a real turn is
  told apart from a mirror. Per model: front -> 3/4, front -> profile, its OWN 3/4 -> low angle.
  9 runs + 1 source, seed 1234, one camera-wording prompt (FLUX.3 guide: "Shift the camera viewpoint").
- PROMPT RULE (Fabio 2026-10-23): the user's photo may already be angled, so a prompt NAMES THE TARGET VIEW
  (side, degrees from where the subject faces, camera height and tilt), never "shift/rotate by X" from the
  current view. Proof: the same target prompt from two different inputs (front, 3/4) lands the same view
  (`angles.py <port> sweep2`, sheet `sweep2_2k.jpg`). `sweep` (FLUX.3 wordings) predates the rule: p1/l1 are
  relative and do not count.
- Stage 2 - full body, only the models that pass stage 1.
- ~~Stage 3 - rooms / scenery~~ DROPPED (Fabio 2026-10-23): a stationary camera looking round a place is the
  360 Panorama Flow (MPI-623). This card is the ORBIT: camera moves round a subject (person, face close-up, object).

## Product shape (Fabio 2026-10-23)
An orbit Flow on FLUX.3: horizontal orbit (yaw: the 8-point strip front, 3/4 front L/R, profile L/R, 3/4 back
L/R, back) x vertical orbit (pitch, 5 levels: extreme low, low, level, high, extreme high). The user generates
every angle (a full strip / grid, e.g. LoRA training sets) or one requested angle, picked on a small 3D gizmo:
two sliders (X yaw, Y pitch) and a tiny 3D view of the camera round a stand-in subject.
Agent notes: the model cannot hit an exact degree, so the sliders SNAP to the tested stops; each stop maps to a
prompt template (side + FRAME direction + 2-3 visible consequences + "only the camera moved"); one edit per view
from a FRONT picture, angled input -> front view first, seed retry on a miss.
Open: pitch x yaw combinations, the extreme stops, objects (no left/right of their own - frame terms only).
Fabio 2026-10-23 on the agent notes: (1) step sliders, yes. (2) one slider moved = one edit; BOTH moved = two
edits (yaw step, then pitch step) - so the bench must also prove a pitch edit on a yaw result. (3) objects: a
short prompt hint for the user, or a quick pass that checks what the subject is before picking the templates.
Fabio 2026-10-23 (UI, after rotate-in-scene passed): keep the two step sliders (turn + height). Add a two-button
radio on top, "Person" / "Object", which swaps the stand-in: a little 3D mannequin or a 3D product (e.g. a shampoo
bottle). The stand-in views are PRE-RENDERED images, one per slider stop, so the user sees which view a stop means.
Maybe a zoom slider, ONLY if a zoom bench passes and it stays easy to use; untested so far.
- Driver: `research/angles.py <port>` through an isolated app (`/connector/generate`) under
  `gpu_lease.py run --poll 2`; results `research/out/stage1.json`, sheet `research/sheets/stage1.jpg`.
- Cards land in project "FLUX3 Flow Bench", named `angles <model> <shot>`.

## Verification
**Verify mode:** user-ux
Sheets in `research/sheets/`; Fabio judges which model + wording holds identity and moves the camera.

## Current State
2026-10-23: stage 1 (face) + stage 2 (full-body orbit) DONE on FLUX.3 Turbo 1K - results, recipe, pass rates
in validation.md. Driver `research/angles.py` (modes: fast vN, body bN, b4, b5, b6, best, b6sheet); results
in `research/out/*.json`, sheets in `research/sheets/`, cards in project "FLUX3 Flow Bench".
2026-10-23: vertical-orbit p1 DONE on one seed (111): `angles.py <port> pitch`, results `out/pitch.json`, sheets
`pitch_face.jpg` / `pitch_body.jpg`, read in validation.md. Body front pitch ladder passes; pitch drowns yaw at the
strong stops; face low angles still tip the head back; TWO-STEP returns copies.
Object p1 DONE (`pitch_object.jpg`): pitch passes on a floating speaker at every stop, yaw fails (the back never
shows). Scene p1 DONE (`pitch_scene.jpg`): pitch moves the whole street; yaw turns the man, the background stays.
DECISION (Fabio 2026-10-23, after the LoRA test): NO LoRA - akhaliq's FLUX.3 angle LoRA and fal's Qwen route
dropped ("our prompting was better"; Qwen slow + poor). Direction: rotate CHARACTERS that sit in scenes with the
prompt recipe; if the scene fights it, fallback = background-removal pass -> rotate the cut-out character -> an
edit places it back into the scene. Subject rotation on a simple background = its own Flow.
Rotate-in-scene p1 DONE (`angles.py <port> rotate`, sheet `rotate_scene.jpg`, seed 111): street holds in all 7
views; profiles, lost profiles and back land (5/7); the two 45-degree views under-turn (tq L head looks the wrong
way). Cut-out fallback not needed so far. 45-degree rework (`HALF`, keys `tq L v2` / `tq R v2`): tq R passes, tq L
turns the right way but only ~30 degrees. The 45s use HALF from now on.
Seeds 222/333 DONE (`rotate_seeds`, sheet `rotate_seeds.jpg`): 17/21 clean + 4 partial (all on the 3/4 front
views), 0 wrong-way, street held in all 21. Rotate-in-scene is proven by prompt; no cut-out fallback.
Turn + height in one prompt DONE (`rotate_pitch`, sheet `rotate_pitch.jpg`): turn holds at every height; high +
extreme high strong; low + extreme low weak and alike; strap-side fix failed (drop it, known limit).
Low rework DONE (`rotate_low`, sheet `rotate_low.jpg`): dropping the anchor gives a small gain on extreme low only
(sky shows on 2/3); low stays mild. Lows use `TURN_LO`, highs `TURN_H`.
Generic two-pass DONE, both wordings (`two_pass`, `short_pass`; sheets `two_pass.jpg`, `short_pass.jpg`): short
generic TURNS work; the height pass on the turned picture is a copy (short) or a fake background swap (long).
NEW DIRECTION (Fabio 2026-10-23): MANNEQUIN REFERENCE. Picture 1 = the user's image, picture 2 = a grey mannequin on
a dark backdrop at the exact target view (angle, height, zoom); the edit (`MQ_EDIT`) asks for picture 1 seen like
picture 2 and names the view in words. The renders double as the gizmo's previews. First t2i refs
(`angles.py <port> mannequin`, sheet `mannequin.jpg`, files `research/mannequin/`): low + high stops weak (back xlo
came out eye level, xhi not a true bird's-eye).
NEXT (Fabio): start with the HARD bit - full-body mannequin refs at LOW and HIGH angles (floor camera pointing up;
high above, bird's-eye). Reword the t2i or retry seeds; if t2i cannot do it, Fabio installs the Blender CLI and the
refs are rendered from a 3D mannequin. As soon as one low + one high ref is right, run the two-image edit
(`mannequin <port> edits`, edit MQ_VIEWS to the views that exist) on the street man and judge it.
ROUND 2 DONE 2026-10-23 (`mannequin2` mode, sheets `mannequin2.jpg` + `mannequin2_edits.jpg`, detail in
validation.md): refs now flat-lit; top-down works when described by what is in frame ("top2"). Edits: zoom + HIGH
transfer; front LOW fails (eye level); back LOW works only with wording B (MQ_EDIT_B, "replace the mannequin") but
copies the mannequin's stiff pose. NEXT: Fabio's eye test on `mannequin2_edits.jpg`, then his call - Blender refs
(exact, extreme low) or more t2i/wording rounds; pose leak from B needs a fix either way.
FABIO CHOSE BLENDER 2026-10-23. WORK FILE (Fabio: work on a copy): `D:\Blender\Projects\OpenPoseBonse_V99\
mpi_openPose_mannequin.blend` - a copy of `mpi_openPose.blend` (his original, saved by 4.3, NEVER write it), re-saved
with 4.5 (header v405) with compositing OFF in both scenes and output PNG. Saving the copy is fine. CLI = Blender's own headless binary, already
installed (4.0/4.2/4.5/5.2 via winget); use 4.5 LTS (`C:\Program Files\Blender Foundation\Blender 4.5\blender.exe
-b <file> --python <script>`; shim `C:\Users\Fabio\bin\blender.cmd`). Opens fine headless. Rig = Auto-Rig-Pro style
`OpenPoseBone_v3_rig` (565 bones, 281 `c_` controls, e.g. c_head.x, c_pos, c_traj); view layer `3D_Doll`; camera
`Camera.001`, 50 mm, 896x1152; engine EEVEE Next. TRAPS: (1) the compositor has File Output nodes into
`MultiControlnet/<pass>/` - a plain `-f 1` render WROTE 18 files there (removed); always
`scene.render.use_compositing = False`; never save the .blend (work in memory or on a copy). (2) output format is
FFMPEG: set `image_settings.file_format = 'PNG'`. (3) Workbench FLAT test (`research/blender/flat_test.py`) rendered
EMPTY: the doll seen in the viewport is not render-visible in that layer (visible meshes: Seg.002, FLOOR, WALL/BED.001)
- find which mesh is the doll and unhide it for render. Scripts: `research/blender/inventory.py`, `flat_test.py`.
FABIO 2026-10-23 (later, SUPERSEDES the "use his doll file" idea): build the refs in a NEW scene with the
CLI-Anything Blender CLI, not his rig: floor + backdrop wall, grey materials, a basic mannequin in an A-pose or
relaxed pose (no specific pose), camera per stop. Use the CLI (skills, fewer tokens) rather than raw bpy; CLI/skills
can be turned off after the job. CLI INSTALLED: `pip install cli-anything-blender` (1.0.0, Python 3.14 user site),
skill text at github.com/HKUDS/CLI-Anything skills/cli-anything-blender/SKILL.md. It finds Blender through
`shutil.which('blender')` = the `C:\Users\Fabio\bin\blender.cmd` shim (4.5; on PATH in Git Bash). Windows traps:
(1) its REPL needs a real Windows console (prompt_toolkit NoConsoleScreenBufferError from Bash); (2) one-shot
`--project x <cmd>` NEVER saves, so state is lost between calls; (3) needs PYTHONIOENCODING=utf-8 or it dies on
'charmap'; (4) `render execute` only WRITES `_render_script.py` next to the output - run it yourself:
`gpu_lease.py run -- <blender.exe> --background --python <script>`. Fix for 1+2: `research/blender/clib.py` runs a
file of REPL lines in ONE process (`python -X utf8 clib.py cmds.txt`); `smoke_cmds.txt` (replace <OUT>) built floor,
wall, cylinder+sphere stand-in, low camera, Workbench 1024 -> `cli_smoke.png` worked. Its objects are PRIMITIVES ONLY
(cube/sphere/cylinder/cone/plane/torus/monkey/empty) - no mesh import. Blender 4.5/5.2 ship NO mannequin asset
(Essentials = brushes + node groups). Mannequin options for Fabio: (a) Blender's free CC0 "Human Base Meshes" bundle
(blender.org demo-files, human-base-meshes-bundle-v1.4.1.zip, size unknown - ASK before download), imported by one
bpy line after the CLI script; (b) a jointed mannequin from CLI primitives (capsule limbs, nose block so front/back
reads); (c) append the doll mesh from his `mpi_openPose_mannequin.blend` copy.
OLD NEXT: design the Blender ref renderer WITH Fabio (which mesh, neutral standing pose via c_ controls, flat grey
Workbench vs EEVEE, camera rig per stop: yaw x pitch x zoom, square masters), render front low first, then rerun the
two-image edits (`mannequin2 edits`, feed Blender refs).
BLENDER REF RENDERER WORKS 2026-10-23 (session "Flux 3 on flows 10"). Mannequin = Fabio's OWN rigged UE4 file
`D:\Blender\Other\UE4_Mannequinn.blend` (rig `HeroTPP_Character`, 147 bones, `CS_` controls, mesh `SK_MannequinMesh`,
in cm, default pose already an A-pose, faces -Y). Do NOT use the Human Base Meshes bundle - it was downloaded by
mistake to `D:\Blender\Assets\human-base-meshes\` (Fabio asked whether to delete it; unused). Pipeline:
`clib.py ref_cmds.txt` (CLI: floor, wall, camera, Workbench 1024) -> `blender -b --python ref_post.py --
out/_render_script.py` under gpu_lease (execs the CLI script minus its render, appends the rig, scale 0.01, STUDIO
light no shadows, floor 0.06 / wall 0.16 / body 0.6, renders). FLAT light was a silhouette (front = back), dropped.
Four stops now (`front_lo`, `back_lo`, `front_hi`, `top2`; ref_post renders every camera). Fabio OK'd front_lo.
ROUND 3 DONE (`angles.py <port> blender`, sheet `mq_blender.jpg`, detail in validation.md): turn (back) + high carry,
LOW still fails with an exact ref (model limit), top-down reads as high, A-pose leaks into the back view even with
wording C. Isolated app this session: port 58665, profile cubric-agent-profile-mpi1039 (mpi1212's is held by
someone else).
FABIO 2026-10-23 (after round 3) NEXT: re-pose the UE4 mannequin to a NATURAL human pose - arms down at its sides,
legs closer together - via the rig's CS_ controls in ref_post.py (append, never write the source .blend), re-render
the four stops, rerun the edits. Watch the PROMPT: the edit copied the mannequin's pose exactly; the mannequin is a
CAMERA reference only. Fabio suspects wording in the prompt confuses the model (B/C say "replace the mannequin ...
standing exactly where it stands ... turned the same way" - that invites a pose copy); reword so picture 2 gives only
camera position/angle/distance, never pose. Unused Human Base Meshes download in D:\Blender\Assets\human-base-meshes\
still awaits Fabio's delete call.
ROUND 4 DONE 2026-10-24 (session "Flux 3 on flows 11"; sheet `mq_blender4.jpg`, read in validation.md): camera-only
wordings D/E (`MQ_EDIT_D`/`_E`, `angles.py <port> blender 4`). Front views keep his own pose now; high passes; E's
top-down is the best yet; low still fails; back views pull the mannequin's BODY in (D pastes it); "camera" draws a
camera prop at his feet. NEXT: Fabio's eye test on `mq_blender4.jpg`, then a wording F = E with "viewpoint" instead of
"camera" (and a fix for the back-view body leak).
ROUND 5 DONE 2026-10-24 (`angles.py <port> blender5`, sheet `mq_blender5.jpg`, read in validation.md): BFL edit
voice + end state (`MQ5`) unlocked LOW (front lo, 1-2 seeds) and a TRUE top-down (1/2); high + turn pass; the
turn-then-height two-step returns a copy at the height step; low views leak the mannequin's grey body. NEXT ideas
(Fabio: keep trying approaches): height FIRST then turn; more seeds for a pass rate; stop the body leak (a less
human ref - silhouette/outline - or a clause that the result has no grey figure).
ROUND 6 DONE 2026-10-24 - BREAKTHROUGH (`angles.py <port> blender6`, sheet `mq_blender6.jpg`): MQ5 view wording +
`MQ6_KEEP` (subject "is still the real person ... own head and hair, hands, clothes and shoes") = 8/8 front low,
8/8 back low in ONE edit, 8/8 true top-down, zero grey leak; line refs = grey refs. Two-step loses both orders
(height>turn 1/4). RECIPE: one edit, exact Blender ref, MQ5 wording + MQ6_KEEP. NEXT: recheck front hi + back eye +
3/4 views with MQ6_KEEP, then other sources (woman, face close-up, object) before the Flow design.
ROUND 7 DONE 2026-10-24 (`angles.py <port> blender7`, 4 sheets `mq_blender7_*.jpg`): full-body people pass every
view on both seeds (man 11/12, woman 18/18, lows milder on a studio backdrop); face close-up: turns pass, low/high
fail; object: high passes, low pastes the mannequin, back + 3/4 fail. NEXT options: an object stand-in ref (grey box
on the floor) for objects; face heights need another route (or the Flow offers turns only on a close-up); then the
Flow design (gizmo -> nearest ref render -> one edit).
FABIO 2026-10-24 (after round 7) - QUESTIONS + SUGGESTIONS for round 8:
(1) Turn Turbo OFF: base FLUX.3 is still fast and gives a NEGATIVE prompt - use it to stop the edit copying the
mannequin's pose/body (and the pasted mannequin on objects). Base = 50 steps cfg 3.5 (~48 s t2i vs 12 s Turbo).
(2) The object stand-in must make FRONT / BACK / SIDES obvious at a glance (e.g. a box with a clear face marking).
(3) Fabio asked: didn't prompt-only already work on the object? ANSWER from this plan: object p1 (2026-10-23,
`pitch_object.jpg`, prompt only, no ref) = PITCH passed at every stop, YAW failed (the back never showed). Round 7
with the mannequin ref did WORSE on object low (pasted mannequin). So: object heights by prompt only, object turns
still unsolved.
ROUND 8 STARTED 2026-10-24 (session "Flux 3 on flows 12", `angles.py <port> blender8`, sheets `mq_blender8_*.jpg`):
base FLUX.3 + `negative` (connector param name; live on base only) on the weak cells; object refs = a YELLOW stand-in
box (Fabio: yellow for contrast) with a white front panel + black disc + dark tab on its frame-right end, built by
`blender/obj_build.py` into a NEW file `out/object_refs.blend` (mannequin hidden, face cams dropped; posed file never
written); `ref_render.py` sees `StandIn` and writes to `out/object/`.
FABIO 2026-10-24 (going to bed, overnight brief): if round 8 is not nice, KEEP TRYING DIFFERENT APPROACHES, use the
GPU as much as needed, aim to have a working solution by morning. May go into Blender again with a different object
if the box is hard for the model - even the mannequin instead of an object. The speaker is too close to the box (both
wide blocks); a PERFUME BOTTLE (or similar) is a better rotation test.
ROUND 8 DONE (read in validation.md): base + negative LOSES to Turbo (people worse, top-down back to a copy) and does
not stop a paste; the yellow box gets pasted into the speaker, but carried one true back view. Turbo stays.
ROUND 9 (`blender9`, sheets `mq_blender9_{bottle,speaker}.jpg`): perfume bottle source (`BOTTLE_SOURCE`, t2i) + bottle
stand-in (`obj_build.py -- bottle` -> `out/bottle_refs.blend` -> `out/bottle/`), and the speaker again; Turbo; arms
ref / line (`ref_render.py -- outline` on the stand-in -> `out/<dir>/outline/`) / prompt (no ref).
ROUND 10 (`blender10`, sheet `mq_blender10_face.jpg`): face heights with steeper refs (`face_build.py` ->
`out/face_refs.blend`: face_xlo / face_xhi) + "keeps looking straight ahead, past the view"; arms xref / ref / prompt.
OVERNIGHT 2026-10-24 RESULTS (rounds 9-14, all read in validation.md):
- OBJECT RECIPE FOUND (round 13 breakthrough, round 14 confirms 66/72 = 92% over nine views on the speaker + a
  perfume bottle): ONE Turbo edit; picture 2 = the PANEL-ONLY OUTLINE stand-in render (`obj_build.py [-- bottle]` ->
  `ref_render.py -- outline nodisc` -> `out/<dir>/outline_nodisc/`); the prompt = BFL voice + an end state that NAMES
  THE OBJECT'S OWN PARTS per view (`MQ14_VIEWS`: "its dark underside with the four rubber feet", "the cap as a gold
  octagon", which end is nearest at which frame side) + `MQ9_KEEP_REF['line']` + `MQ9_KEEP`. Generic wording ("its top
  face", "its back") never reached top-down or the rear 3/4 - naming the parts did. In the Flow the agent (Cosmo) can
  see the object and write these. Solid stand-ins get PASTED; the outline mannequin is worse than the stand-in.
- Base + negative (round 8) is NOT a lever; Turbo stays.
- FACE CLOSE-UP HEIGHTS SOLVED (round 15 studio 4/4 lo + 4/4 hi, round 16 a man outdoors 4/4 + 4/4): steep head refs
  (`face_build.py` -> face_xlo / face_xhi) + an end state that names WHAT THE NEW VIEW REVEALS behind the subject
  (lo: "the studio ceiling with a softbox" / "upper floors leaning in and the open sky"; hi: "the studio floor" /
  "the cobbles fill the background"). Without that a close-up height becomes a head tilt (rounds 10, 12 failed).
- ONE RULE NOW for people, faces and objects: one Turbo edit, an exact ref (mannequin for people, panel-only outline
  stand-in for objects), BFL voice, an end state naming the SPECIFIC things now in view, the matching keep clause.
NEXT: Fabio's eye test on `mq_blender14_{speaker,bottle}.jpg`, `mq_blender15_face.jpg`, `mq_blender16_manface.jpg`;
then the Flow design: gizmo -> nearest ref render -> the agent (it sees the picture) writes the end state -> one edit.
FABIO 2026-10-24 (morning) eye test: people + face sheets look okay; the OBJECT passes do not count yet - each had a
stand-in shaped like itself, at one distance. ROUND 17 READY, NOT RUN (Fabio: ASK before any GPU run, he is testing
too): `obj_build.py -- cube` -> `out/cube_refs.blend` -> `ref_render.py -- outline` -> `out/cube/outline/` (one plain
cube + panel for every product, zoom cams front_hi/tq_fl `_near`/`_far` by lens); `angles.py <port> blender17 sources`
= 4 t2i sources (sneaker on a floor seen side-on, mug close-up on a table, floating headphones, handbag small in a
boutique) + ref imports + sheets; then write `MQ17_VIEWS` from what the sources show (as the Flow's agent would) and
`angles.py <port> blender17` = 4 products x 10 views (6 angles + 4 zooms) x 4 seeds = 160 Turbo edits (~70 min with
Fabio sharing the GPU). ROUND 17 DONE (first read in validation.md, Fabio's eye test pending): the generic cube carries
turns, back, high and ZOOM (near 31/32, far 31/32) across unlike shapes; LOW fails on resting products (~2/16) and
top-down fails on the headphones. NEXT: Fabio's eye test on the four mq_blender17 sheets; render Cosmo (ask for the
GPU); then a low-wording fix + the HOUSE stand-in round.
REF PIPELINE NOW (2026-10-24, SUPERSEDES ref_post.py): the pose lives in Fabio's hand-posed copy
`research/blender/out/UE4_Mannequinn_refs.blend` (Blender 5.2; out/ is gitignored - it exists only on this disk). It
was made ONCE by `cp D:\Blender\Other\UE4_Mannequinn.blend` + `blender-5.2 -b <copy> --python ref_build.py --
out/_render_script.py` (CLI floor/walls/cameras minus the CLI's delete-everything step, his left arm mirrored to the
right, feet in, T-Pose action dropped - his pose is not keyed). NEVER rerun ref_build on it (it would overwrite his
tweaks). Renders: `gpu_lease.py run -- blender-5.2 -b out/UE4_Mannequinn_refs.blend --python ref_render.py`. Rig
facts: `research/blender/rig_inspect.py` header. Fabio: the posing needs a real rig in Blender, not bpy guesses.
Isolated app this session: port 58665, profile cubric-agent-profile-mpi1039.
Prompt rule (Fabio + playbook 01 § READ THE MODEL'S GUIDE): generic ("the subject"/"they"), no "photograph" in edit
prompts, FLUX.3 edit voice. The MQ_BODY t2i ref prompt may say "Studio photograph" - it is our asset, not a user edit.
Isolated app this session: port 57477 (profile cubric-agent-profile-mpi1212).
Fabio 2026-10-23 (earlier): training our own angle LoRA is on the table (~$50 a LoRA is fine; later a Discord money
pool per LoRA, budget + small margin). Cost = steps x GPU time, not dataset size.
Fabio: subject rotation on a simple background = a Flow of its own. Angle-LoRA survey in validation.md
(FLUX.3 base LoRA + public training data exist). Proposed next: test akhaliq's FLUX.3 angle LoRA on our 4
sources before deciding to train our own.
Older NEXT: Fabio's eye test on the four pitch sheets, then his call on (a) the two-step finding (one combined prompt
from the front instead), (b) whether to run seeds 222/333 or rework the face-low and yaw+pitch wording first.
Objects after.
Isolated app (port 52430 this session; down when the session ends): relaunch with `CUBRIC_AGENT_PROFILE=%LOCALAPPDATA%\Temp\cubric-agent-profile-mpi1212
node scripts/launch-instance.mjs` (run_in_background), use the printed port. Every GPU run under
`gpu_lease.py run --poll 2 --timeout <long>`; a peer often holds the GPU.

## Future directions (Fabio 2026-10-24, notes only - NOT the current route)
- Fabio's read of rounds 13-14: the object passes are suspect - each product had a stand-in built to ITS OWN shape
  (box for the speaker, flask for the bottle) at ONE distance. The recipe only counts once ONE generic stand-in set
  carries differently shaped products, at different distances. That proof = round 17 (below, in Current State).
- Community route: Qwen-Image-Edit 2511 + a multi-angle LoRA + a ComfyUI multi-angle custom node whose gizmo
  probably emits ready-made prompts. Worth reading the node for its prompt table even if we stay on our recipe.
- Two-model split sampling: an earlier exploration ran the first steps on Qwen (pose / ControlNet) and the last on
  KREA2 (same architecture, same text encoder) for a KREA2-quality result. Could apply here; also check which other
  models share Qwen's latent/architecture (Qwen-Image 2.1? FLUX.3?). Many tests - slow.
- Cheaper variant: generate the angle on Qwen, then feed that output as a REFERENCE to Qwen-Image 2.1 / FLUX.3.
- NSFW: a FLUX.3 Flow cannot do NSFW sources; Qwen-Image 2.1 can. Fabio leans to Qwen-Image 2.1 for the Flow's model
  - the recipe should be re-run on Qwen-Image 2.1 before the Flow design locks in FLUX.3.
- Video route: ask a video model for the camera move (orbit, zoom in/out) - it hallucinates what it must - grab the
  frame at the target angle, use it as the image model's reference.

## Flow UI notes (Fabio 2026-10-24)
- The gizmo's preview of the chosen view + zoom = a 3D COSMO (Fabio makes it on an image-to-3D site). Previews stay
  pre-rendered, one per slider stop, from the SAME Blender cameras as the model refs, so the preview shows exactly the
  view the edit gets. Keep Cosmo OUT of the model's ref (mannequin / cube / house) unless a bench proves it does not
  get pasted. Idea under test next: a simple HOUSE stand-in (square, roof, front door, maybe one chimney for left/right).
- Image-to-3D site failed (front doubled onto the back, no textures, messy mesh). Cosmo is now BUILT, NOT YET RENDERED:
  `blender/cosmo_build.py` (run on `out/UE4_Mannequinn_refs.blend`, writes `out/cosmo.blend`, keeps the ref cameras)
  = plain boxes + the art STAMPED on (Fabio): decals `out/cosmo_tex/head.png` + `torso.png` cropped from `Cubric Studio
  Brand Assets/Studio-Idle.png`; hands/feet stretched spheres; ears = disc + dark ring + antenna (back ref: Fabio's
  screenshot `Pictures/Screenshots/Screenshot 2026-10-24 101751.png`). Body #a16d6a (Fabio eye-dropped it from the app;
  not yet in DESIGN.md - offer a Cosmo colours row after his eye test), screen/collar cream = --hub-accent, lines =
  --surface-viewer. Flat emission + Freestyle, EEVEE. NEXT: render front / tq_br / top2 (ASK for the GPU), Fabio's
  eye test; watch the head decal's rounded corners over the square box and the line thickness.
- 2026-10-24 Cosmo RENDERED (Fabio's GPU yes): front_hi, front_lo, tq_br, top2 -> `out/cosmo/*.png` (gitignored; one-off
  script renders named cameras only, so ref_render.py's out/<camera>.png mannequin refs stay untouched). Agent read: front
  views read as Cosmo; top2 is a flat brown square with ear stubs - nothing says "top of Cosmo" (needs a top marking
  if top-down stays a gizmo stop). Fabio's eye test pending.
- 2026-10-24 Fabio: "doesn't look right" - his 10:37 build had BEVELS (head .09, torso .08, arms .09, legs/neck .02,
  4 segments), but the 10:40 rerun of cosmo_build.py (no bevels) overwrote it; the 10:37 file had lit Principled mats +
  a sun (renders near-black), so only its bevels are worth keeping. Kept as `out/cosmo_bevel.blend`. box() now takes
  the bevel width; cosmo.blend rebuilt 12:38 with them. Re-rendered to `out/cosmo/` (Fabio's GPU yes): rounded edges
  show on back/top views; on the front views the flat decals keep square corners over the rounded head/torso.
  Fabio: the decals read as a hard-edged WIREFRAME on face + chest = Freestyle tracing the decal planes' square
  borders. Fix: decals in collection `Cosmo_art`, lineset excludes it (select_by_collection EXCLUSIVE); rebuilt.
  Re-rendered (Fabio's GPU yes): square wireframe gone, outlines follow the rounded boxes. FABIO EYE TEST: PASS
  ("Cosmo looks right"). Renders = `out/cosmo/{front_hi,front_lo,tq_br,top2}.png`, made by a one-off named-camera
  render (copy of ref_render.py's loop writing to `out/<blend stem>/`). Open: top2 is a plain rounded square (no "top"
  mark) - decide only if top-down stays a gizmo stop; offer Fabio a Cosmo colours row in DESIGN.md (#a16d6a).
  NEXT for the card: Fabio's eye test on the round-17 sheets (still no verdict), then the low-wording fix + HOUSE round.
FABIO 2026-10-24 (afternoon): OBJECTS DEFERRED - focus on PEOPLE, run the people tests still open, in a fresh session.
People tests still open (agent's list, from validation.md rounds 5-7, 12, 15-16):
  1. Pass rate on 4 seeds (111-444) for FULL BODY - rounds 5-7 ran only 2 seeds: man (street) + woman (studio), every
     view (front lo/hi, top2, back eye, back lo, tq fl/fr/bl/br) with the round-7 recipe (MQ5/MQ7 wording + MQ6 keep +
     mannequin outline refs from Fabio's posed file).
  2. ZOOM on people (untested; round 12's zoom-in on a face returned the input 0/8): near/far zoom cams on the
     mannequin file (same as obj_build's `_near`/`_far` lens twins) with round 17's zoom end-state sentences.
  3. Face close-up on 4 seeds for the turns + heights together (rounds 15-16 proved heights 4/4; turns only on 2 seeds).
  4. Plain-backdrop full-body LOW is mild (round 7 woman) - apply round 15's rule (name what the new view reveals:
     studio ceiling / softbox) to the full-body studio low views.
  Then Fabio's eye test; Qwen-Image 2.1 re-run (NSFW) stays queued after.
FABIO 2026-10-24 (afternoon, after rounds 19-22: "making progress, well done"): concern - every test source is PHOTOGRAPHIC; the recipe's words (real person, studio, softbox) may push a 2D source toward realism. NEXT ROUND = a flat 2D test, kept SHORT: convert the man or the woman to flat anime with Krea2 (Fabio: "Create2", its anime style, via edit / i2i), then run the people recipe on that one source (few key views, few seeds). Keep clause must say the drawing style stays (not "real person"). Then the 3/4 front-turn overshoot ref, Qwen-Image 2.1 re-run.
FABIO 2026-10-25 (NSFW sources): FLUX.3 is already proven to keep a naked character naked, and it cannot create nudity that is not in the source; Qwen-Image 2.1 can create it, and also keeps an already-naked character naked. So both models of the split keep an NSFW source as-is - a dedicated NSFW round is likely not needed (agent pick: skip it). Watch-out for the Flow: Qwen is the model that CAN add nudity, so Qwen steps keep the child-safety gate in front of them like every other edit.
ROUND 33 DONE (2026-10-25, validation.md; FABIO's eye test on sheets 31-33: they look right): Qwen high on a turn + a reveal line naming the street from above (paving, kerb, shop-front bases, that turn's landmarks) brings the anime street back 4/4, high + turn side kept; she still comes out smaller than the input. RECIPE NOW: front stops on FLUX.3; a turned stop = FLUX.3 yaw, then (if pitched) Qwen pitch with a reveal line - low and high both proven. NEXT: optional framing line for Qwen's pulled-back high; then the NSFW sources check (FLUX.3 vs Qwen).
ROUND 32 DONE (2026-10-25, validation.md, Fabio's eye test pending): high on a turn - FLUX.3 without the keep-the-view clause is STILL 0/8 (it will not change the pitch of a turned picture); Qwen-Image 2.1 8/8 a real high with the turn side kept, but the anime street is lost 4/4 (flat purple ground; photo floor fine). So the split: FLUX.3 yaw, then Qwen for ANY pitch change (low or high) on a turned stop. NEXT: round 33 = Qwen high on a turn with a reveal line naming the place from above (paving, kerb, shop-front bases, vending machine) on the 4 anime cells; then NSFW sources; Fabio's eye test on sheets 28-32.
ROUND 31 DONE (2026-10-24 night, validation.md, Fabio's eye test pending): mirrored turns work (tq fr 4/4 big turn, tqb l 4/4 right side); FLUX.3 turn THEN Qwen low 12/12 on tq fr / tqb l / back (with round 30: 20/20 on every non-front stop), 'her whole head still in frame' -> no head cut (2/12 hair at the edge). HIGH ON A TURN FAILS 0/8 - FLUX.3 returns the turned input unchanged; suspect the 'keep the same ... view as in the first image' clause. Refs: `blender/plain_build.py` makes low twins for all four 3/4 cams + high twins tq_fl_hi / tq_br_hi. NEXT: round 32 = high on a turn without the keep-the-view clause (FLUX.3) and on Qwen, 8 + 8 edits; then NSFW sources; Fabio's eye test on sheets 28-31.
ROUND 30 DONE (2026-10-24 night, validation.md, Fabio's eye test pending): (b) FLUX.3 turn THEN Qwen low = 8/8 - a real ground-level low on every turned view, side + place + style kept (1/8 head cropped). So the split chains: a low on a turned stop = FLUX.3 yaw edit, then Qwen pitch edit, with the low-twin refs (blender/plain_build.py -> tq_fl_lo / tq_br_lo). (a) a plain-white doll ref: Qwen copies the REF's background whatever it is - the room paste drops 9/20 -> 4/20 but those go white; the low stop holds 4/4 on it. Qwen only runs lows in the split, so use the plain refs there. NEXT: Fabio's eye test on sheets 28-30; then the other low twins (tq_fr/tq_bl/back) + high-on-a-turn, the head-crop line, NSFW sources.
DECISION (Fabio 2026-10-24, after round 29's sheet): THE SPLIT - the LOW stop runs on Qwen-Image 2.1, the turns, back and high stops on FLUX.3 (per-stop model routing, as the Character Sheet Editor's operationBy). Open: the pitch x yaw combos (a low on a turned view = FLUX.3 turn, then Qwen low?), Qwen's room paste on a neutral-background ref, NSFW sources.
ROUND 29 DONE (2026-10-24 night, validation.md, Fabio's eye test pending): Qwen-Image 2.1 re-run, 20 edits. Qwen WINS the LOW stop (4/4, true ground-level worm's-eye, place kept); elsewhere it pastes the doll ref's grey room ~9/20 and overshoots tq fl to profile - FLUX.3 held the place 20/20. FABIO 2026-10-24: blend the two per stop, as the Character Sheet Editor does (operationBy routing). Candidate split: low -> Qwen, turns/back/high -> FLUX.3. NEXT: Fabio's eye test on sheets 25-29; then maybe Qwen with a neutral-background doll ref (does the room paste go?), and the NSFW source check.
ROUND 28 DONE (2026-10-24 night, validation.md): a middle wording ('three-quarter view', 'about halfway', far shoulder partly hidden) REGRESSES to the old mild ~15-20 deg turn, 8/8 - FLUX.3 reads turn words as two settings, not a dial. Reverted: round 27's _TURN27 stays the 3/4 front wording. NEXT: round 29 = the Qwen-Image 2.1 re-run of the recipe (`angles.py <port> blender29`, 20 edits, sheet mq_blender29_qwen, FLUX.3 cells beside); then Fabio's eye test on the sheets 25-29.
ROUND 27 DONE (2026-10-24 evening, validation.md, Fabio's eye test pending): overshoot in the WORDS (45-deg ref, 'almost side-on' end state) MOVES the 3/4 front turn - anime 4/4 but overshoots to profile, photo 4/4 better (2/4 a real three-quarter). Turn size = words, not ref. NEXT: a middle wording to land at 45 on both (or keep this as a SIDE stop); then the Qwen-Image 2.1 re-run. Fabio 2026-10-24: try the middle wording (round 28, 8 edits, GPU ok); if it regresses vs round 27, revert to round 27's _TURN27.
ROUND 26 DONE (2026-10-24 evening, validation.md, Fabio's eye test pending): overshoot REF for the weak 3/4 front turn (doll at 65 / 80 deg, 45-deg words) changes nothing - anime 0/8 (same as 45), photo 0/8 (turns LESS, tighter). The ref angle does not set the turn size. NEXT: Fabio's call - overshoot in the WORDS (nearly-profile wording, 45-deg ref) or accept the mild 3/4 front; then the Qwen-Image 2.1 re-run.
ROUND 25 DONE (2026-10-24 evening, validation.md, Fabio's eye test pending): turn-reveal wording on the 2D street - the end state names the place's landmarks from the new side, in FRAME terms (source vending machine is frame-left = her right). The street now moves on every turn: back eye 4/4 (reads as the source street mirrored), tqb r 4/4, tq fl 4/4 on the place; her body on tq fl still turns only ~15-20 deg. Style 12/12, no doll pasted. Flow rule: the agent names the place per view. NEXT: Fabio's eye test on mq_blender25_turn_reveal; then the 3/4 FRONT overshoot ref (doll, camera 60-70 deg), Qwen-Image 2.1 re-run.
ROUND 24 DONE (2026-10-24 evening, validation.md): Fabio's unisex ControlNet doll (his OBJ export, natural pose, skin tone) replaces the UE mannequin - `blender/doll_build.py` -> `out/doll_refs.blend` -> `ref_render.py` -> `out/doll/<cam>.png` (all 14 cams rendered; refs dir picked by the scene's 'refdir' prop). Back views clean 16/16 (anime + photo), the anime mannequin paste gone, low view as strong. DOLL = THE PEOPLE REF from now on. Fabio is restarting his app - start no run until he says. NEXT: the 2D street turn-reveal wording (the street still freezes on turns), then the 3/4 front overshoot ref (doll), Qwen-Image 2.1 re-run.
ROUND 23 DONE (2026-10-24 evening, validation.md, Fabio's eye test pending): flat anime woman (Krea2 Retro Anime) put on an anime street by a second Krea2 edit (Fabio: a place is the harder test) -> 'street 222'. Drawing style held 20/20; front hi 4/4, front lo reveal 4/4 strong; turns move HER but FREEZE THE STREET (0/12 - she turns on the spot); back eye pasted the mannequin 2/4 (first time on people); tq fl far ~1/4. NEXT: Fabio's eye test on mq_blender23_anime; then a turn-reveal round on the 2D street (name the reversed street) + outline ref vs grey mannequin; then the 3/4 front overshoot ref, Qwen-Image 2.1 re-run.
ROUNDS 20-22 DONE overnight (validation.md, Fabio's eye test pending): 20 = ref padded to the source size changes nothing (keep it as the Flow's size rule); 21 = ZOOM WORKS IN WORDS relative to the source + naming the crop/what newly shows, no zoom ref needed (woman far 8/8 with the studio rig, tq near 4/4, man tq 8/8; front-hi near weak); 22 = subject-specific wording does NOT fix the weak 3/4 FRONT turns - rounds 7/19 over-rated them (mild, ~15-20 deg). NEXT: Fabio's eye test on mq_blender19-22; then the 3/4 front turn (overshoot ref idea), Qwen-Image 2.1 re-run.
ROUND 19 DONE (first read in validation.md, Fabio's eye test pending): people pass 4/4 at every view in a real place; studio low passes with the reveal wording; close-up rear 3/4 lands as profile; zoom works on the street man (near 8/8, far 6/8) but not on the plain studio woman (tq fl 0/8). NEXT: Fabio's eye test; then studio zoom with reveal/crop wording, then the Qwen-Image 2.1 re-run.
FABIO 2026-10-24 (evening): REF SIZE RULE for the Flow - the OUTPUT size is the user's custom size (edit + Control ops now all have a custom-size option, landed in another session today) or, with custom size off, the source picture's size. The pre-rendered mannequin ref is what adapts: resized/padded (Resize Image v2, pad edge pixel) to that output size. Round 20 tests the custom-size-off path (ref padded to the source size). Rounds 6-19 edited at FAST 4:5 with a square ref (and the woman's 9:16 source) - three shapes in one edit. Fabio said the GPU is free during his nap (2026-10-24): run rounds without asking for that stretch.
FABIO 2026-10-24 (own test, LTX 2.5 project): FLUX.3 edit on a NUDE source kept the nudity (no bikini added) on a plain "low-angle floor camera" prompt; it smoothed skin texture and the view came out closer, not low. So "FLUX.3 cannot do NSFW sources" above is not absolute - recheck before the Qwen-Image 2.1 decision.
ROUND 18 DONE (first read in validation.md, Fabio's eye test pending): house PASTED on the plain-backdrop headphones
(7/24) and bought no top-down; low moved by the WORDING alone (house = cube), but "edge-on thin line" squared the round
plinth. Agent pick: back to the cube; NEXT idea = top-down without a ref / two-step high -> top. Was:
ROUND 18 READY, NOT RUN (2026-10-24): `obj_build.py -- house` -> `out/house_refs.blend` BUILT (house on a plinth: door
front, roof, chimney back-right; the plinth = the surface, so front_lo shows no underside - round 17's floating cube
did). Then (GPU) `gpu_lease.py run -- blender -b out/house_refs.blend --python ref_render.py -- outline` ->
`out/house/outline/`, then `angles.py <port> blender18` = 4 products x (6 house views + cube lo) x 4 seeds = 112 Turbo
edits on the round-17 sources (MQ18_LOW = camera lowered to the surface, seen edge-on). Sheets mq_blender18_<name>.
Fabio 2026-10-24 (agrees): a low shot of a RESTING object = camera close, down at the surface - it cannot go below the
floor; only a FLOATING object (some product shots) has an underside to show. Flow consequence: the agent reads
"resting or floating" off the source and picks the low ref + wording. Caveat for round 19: front_lo sits at z 0.15,
BELOW the plinth top (0.6), so the house ref shows the plinth's face, not a camera skimming the surface top.

## Remaining Work
- [ ] Stage 1 (face, 9 runs) + Fabio's eye test
- [ ] Stage 2 full body, stage 3 rooms
- [ ] Decide: Flow or not

## Completed

## Plan Drift
