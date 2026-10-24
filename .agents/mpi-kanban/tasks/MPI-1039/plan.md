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

## Remaining Work
- [ ] Stage 1 (face, 9 runs) + Fabio's eye test
- [ ] Stage 2 full body, stage 3 rooms
- [ ] Decide: Flow or not

## Completed

## Plan Drift
