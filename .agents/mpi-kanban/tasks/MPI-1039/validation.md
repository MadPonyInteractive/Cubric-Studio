# MPI-1039 validation

2026-10-22: bench started (Fabio's GPU go, lease shared with a peer).

Stage 1 at 1K (sheet `research/sheets/stage1.jpg`, source 896x1088 FLUX.3 base, seed 1234, edits keep size):
- FLUX.3 base: 3/4 turned to the WRONG side (shows her right cheek/mole); profile best of all (correct side,
  hoop, face held); low = near copy of its 3/4, camera never moved.
- Klein 9B: 3/4 + profile correct side, face slightly thinner, hair lighter; low = she tilts her head UP
  (subject moved, not camera), earring jumps ears.
- Qwen-Image 2.1: 3/4 + profile correct side, face held, hair darker/straighter; low = broken (over-sharpened
  HDR look, aged skin, camera not low) - a second edit on its own output degrades.
- No model moves the camera low. Profile: all three pass.
FABIO 2026-10-23 (eye test, overrides the agent read above): best 3/4 = Qwen-Image 2.1; low angle - only
Klein 9B passes (head tilt reads as a low angle to him); profile winner = Klein 9B. FLUX.3 wins nothing.

Stage 1 at 2K (sheet `research/sheets/stage1_2k.jpg`; new 1280x1600 FLUX.3 base source, edits with no ratio):
- Only FLUX.3 ran at 2K (1280x1600, ~240 s per edit vs ~90 s at 1K). Klein 9B came back 912x1152 and Qwen
  928x1152: with no ratio their graphs cap the edit near 1 MP. A real 2K Qwen needs ratio + qualityTier 2k.
- FLUX.3 2K: 3/4 now the correct side but a small turn (~20 deg); "profile" only ~45 deg; low = copy of its
  3/4 again. Higher resolution did not fix it.
- Klein 9B: same pattern as 1K - correct 3/4, clean profile, low = head tilt with a slightly lower camera.
- Qwen: 3/4 + profile good; low BROKEN again, same over-sharpened HDR look -> reproducible: Qwen editing
  its OWN edit output degrades. Not yet tried: Qwen low angle straight from the source.

FLUX.3 prompt loop (Fabio 2026-10-23: Turbo, 4:5 1K, FLUX.3 only, ~21 s/run; `angles.py <port> fast vN`,
prompts in VERSIONS, sheets `fast_v1..v4.jpg`, winners `fast_best.jpg`). Every prompt names the TARGET view;
each runs from two inputs (front source, FLUX.3 2K 3/4) and passes only if both land the same view.
- v1 (sweep2 TARGETS): 3/4 + profile PASS from both inputs. Low 3/4 fails (wrong side / looks up).
- v2: low straight-on PASSES from both ("camera at the height of her chest, below her face, pointing upward ...
  her chin is nearer the camera than her eyes ... Her head is not tilted back: only the camera is lower").
  'lo perspective' = milder pass. 'lo below' (one sentence) = no change.
- v3: high straight-on PASSES (same shape, camera above, "forehead nearer the camera than her chin").
  Low/high + "45 degrees to her left" lands the side only from the 3/4 input (front -> weak or WRONG side).
- v4: adding "so she faces partly toward frame-left" (a picture direction, not her left) -> low 3/4 and high
  3/4 PASS from both inputs.
Recipe that works: "Create a photograph of <subject> from the first image" + camera height and pitch +
side in degrees + the FRAME direction the subject faces + 2-3 visible consequences (what is nearer the
camera, what shows / hides) + "her head is not tilted: only the camera moved" + one keep-line.
Drift: high angles change her expression (looks up into the lens, slight frown).
So the earlier FLUX.3 losses were the PROMPT (relative "shift", no height/pitch, no frame direction), not the model.
FABIO 2026-10-23: face angles pass. Stage 2 full body on FLUX.3 Turbo 9:16 1K (`angles.py <port> body bN`,
prompts BODY / BODY2 / ORBIT, sheets `body_b1..b3.jpg`).
- b1/b2: from the FRONT - profile, back, low and high straight-on pass (strong); 3/4 L turns too little; low 3/4
  never moves. From an ANGLED input (b1 profile, b2 3/4) almost nothing turns: Turbo holds a full-body pose far
  harder than a face.
- b3 = Fabio's LoRA-training orbit (front, 3/4 front L/R, profile L/R, 3/4 BACK L/R lost profile, back): from the
  FRONT all 7 views PASS (sheet `body_b3.jpg` top row). Wins: "body angled halfway between facing the camera and
  facing frame-<s>" + "<o> shoulder and arm partly hidden behind her body" for 3/4 front; "lost-profile view,
  camera 135 degrees round, behind her" + "only the edge of her cheek and jawline show; eyes and nose hidden" for
  3/4 back. From the 3/4 R input: only 3/4 back R turns the body; 3/4 back L turns the head only; the rest ~ input.
- b4 (angled input, Fabio's two ways out; sheet `body_b4.jpg`): FRONT from the profile input PASSES; front from the
  3/4 R input FAILS (~unchanged), so b4's via-front orbit sat on a failed front and proves nothing. BASE model
  (Turbo off, ~87 s/run) from the 3/4 R input: all 4 hard views ~ input -> base does NOT help.
- b5 (sheet `body_b5.jpg`): front-from-3/4 on seeds 111/222/333 = ALL THREE PASS (clean front views); seed 1234
  was the one that copied. Orbit from the good front (seed 1234): pr L, 3/4 back L, pr R pass; 3/4 back R
  partial; 3/4 L and 3/4 R ~ unchanged; back = head turned only. Same prompts gave 7/7 from the b1 source.
  => Results are SEED-SENSITIVE: a one-seed sheet is a coin toss per view. The real number is a pass rate over
  several seeds; a Flow would need a seed retry (or N seeds and a pick) per view.
- b6 PASS RATE (Fabio 2026-10-23; ORBIT prompts, Turbo 9:16 1K, seeds 1234/111/222/333; graded on head crops
  `body_b6_<front>_heads.jpg`, full bodies `body_b6_<front>.jpg`; pass = right view AND right side of the face):
  | view | from b1 source (front t2i) | from "good front" (made from a profile) |
  | 3/4 front L | 4/4 | 3/4 |
  | profile L | 4/4 | 4/4 |
  | 3/4 back L (lost profile) | 4/4 | 4/4 |
  | back | 4/4 | 3/4 (s1234: head turned back on a front-facing body) |
  | 3/4 back R | 4/4 | 3/4 (s1234 partial) |
  | profile R | 4/4 | 4/4 |
  | 3/4 front R | 4/4 | 3/4 |
  Total 28/28 and 24/28; every miss is seed 1234 on the good front. Left/right never mirrored.
  Caveats: on 3/4 front views the FACE turns fully but the body only mildly; the good front (2 edits from the
  source) drifted identity (hair slicked back, face older) - each chained edit costs likeness.
Graph fact: a sent ratio makes FLUX.3's edit shrink picture 1 to 1 MP (flux3_t2i.json node 824); no ratio
edits picture 1 at its own size. 2K rerun = 2K source + no ratio.

Vertical orbit p1 (Fabio 2026-10-23: one seed first; seed 111, Turbo 1K, `angles.py <port> pitch`, prompts =
`pitch_prompt()` = yaw (YAWS) + pitch (PITCHES) + keep-line; sheets `pitch_face.jpg`, `pitch_body.jpg`; 32 runs
~21 s each). Agent read, awaiting Fabio's eye test:
- BODY front, all 4 pitches PASS, a clean ladder: xlo (camera on the floor, sneakers huge), lo (milder), hi,
  xhi (true bird's-eye, floor all round). Pitch on a full body is easy.
- BODY 3/4 front L: level + lo = 3/4 and lower, pass; xlo / hi / xhi = pitch lands but the body goes ~FRONTAL
  (yaw lost). The stronger the pitch wording, the more it drowns the yaw.
- BODY 3/4 back L: level + lo = good lost profile; hi = 3/4 back from above (pass); xlo = near straight back,
  strong low; xhi = top-down but she turns her head to show a profile (partial).
- FACE front: lo / xlo = real low camera BUT her head also tips back (subject moved, the old failure); hi =
  pass; xhi = barely more than hi (not a bird's-eye), she looks up into the lens (the known expression drift).
- FACE 3/4 L: level turn is small on this seed; every pitch pulls it back toward frontal, lo/xlo with the head
  thrown back. FACE 3/4 back L: level = ~90 profile, not 135; lo/xlo = profile with head thrown back; hi/xhi =
  real lost profile from above (the best back views).
- TWO-STEP FAILS on both subjects: the 3/4-L + lo/hi prompt run on the 3/4-L level result returns a near COPY
  (mean pixel diff vs input 3-9; the same prompts from the front differ by 14-35). Matches b4: Turbo will not
  re-pose an already-angled picture. => "both sliders moved = two edits" does not work as asked; one combined
  prompt from the front is what moves (partly).

Object p1 (Fabio 2026-10-23: a plain floating product, nothing that can tilt a head; seed 111, Turbo 1K, same
3 yaws x 5 pitches + two-step; OBJECT_SOURCE = boxy speaker, grille front, strap at frame-right, buttons on top,
feet underneath; sheet `pitch_object.jpg`). Agent read, awaiting Fabio's eye test:
- PITCH from the front PASSES at every stop: xlo / lo show the underside with its feet and the grille tilting away;
  hi shows the top face with the three buttons; xhi more top, but still not a true bird's-eye. With no head to
  tip, the camera itself moves: the face's "head thrown back" is the model posing a person, not a camera limit.
- YAW FAILS: 3/4 and 3/4-back at eye level ~= the input (mean diff 9 vs the source); the strap end never turns to
  face the camera and the back panel NEVER appears. Low/high yaw cells roll the box in-frame (Dutch tilt) instead
  of orbiting. The grille (hero face) always stays toward the camera.
- TWO-STEP MOVES on the object (diff 15 vs its input, 1-step 24-29), unlike the people - but its input (the failed
  3/4) was really a front view, so this only says pitch-on-a-front works twice, not pitch-on-an-angled-picture.
- Idea for the next object run: on a plain backdrop "turn the product 45 degrees" and "orbit the camera 45 degrees"
  make the same picture (bar the light), so object yaw may land as an OBJECT rotation where the camera wording
  fails; people cannot use that (they would turn their body against the scene).

Scene p1 (Fabio 2026-10-23: waist-up character IN a place; seed 111, Turbo 1K, same grid; SCENE_SOURCE = bearded
man on a cobbled street, red door frame-left, blue bicycle frame-right, string lights overhead, bag strap on his
left shoulder; sheet `pitch_scene.jpg`). Agent read, awaiting Fabio's eye test:
- PITCH moves the WHOLE SCENE, the best pitch result so far: lo / xlo bring in sky, building fronts towering and
  the lights overhead; hi / xhi turn the background into cobbles with the door and bicycle seen from above, xhi a
  near bird's-eye with his feet in frame. Holds on all three yaws. Small head-tip up on xlo / tq L lo.
- YAW is the subject turning, NOT the camera: 3/4 L and 3/4 back L land on him (lost profile clean at every
  height), but the red door + bicycle stay behind him in every yaw cell - a real 135-degree orbit would look the
  other way down the street. So a back view in a scene = the man turned to face the wall.
- TWO-STEP: lo = copy (diff 4.6 vs its input; 1-step 49); hi moved partly (19). Same as the people runs.
- Identity held across the grid (beard, jacket, strap side right).
FABIO 2026-10-23: "rotate the subject on a simple background" is a Flow of its own. Next idea: an angle LoRA (+ zoom).

Angle LoRA survey (2026-10-23, HF API reads, nothing downloaded):
- fal/Qwen-Image-Edit-2511-Multiple-Angles-LoRA: Apache-2.0, base Qwen-Image-Edit-2511 = our `qwen-edit` card
  (base Apache-2.0 too). 96 poses = 8 azimuths x 4 elevations (-30/0/30/60) x 3 DISTANCES (close-up / medium /
  wide = zoom). Prompt `<sks> front-left quarter view low-angle shot close-up`. 295 MB, ComfyUI workflow in repo.
  Training data NOT published ("3000+ Gaussian Splatting renders", fal-internal). 66k downloads.
- akhaliq/flux-3-image-klein-angles-lora: FLUX.3 Klein BASE (not Turbo), FLUX Kommunity licence (same as our
  flux3-klein). 8 azimuths x 5 elevations (low / eye / elevated / high / top-down) + close-up; `<mva> right side
  view, elevated shot`. 80 MB, rank 16, 512 px, 2000 steps on one A100, diffusers format (ComfyUI key names
  unproven). Own caveat: synthetic renders -> people/animals re-angle well, plain OBJECTS can be hallucinated.
- akhaliq/Qwen-Image-2.1-Multiple-Angles-LoRA: Apache-2.0, base = our `qwen-image-2-1` (ships NC-gated). v2 rank 64.
- DATA IS PUBLIC: akhaliq/flux3-multiple-angles-train (16,670 pairs, 4.5 GB) and -4k (4,000 pairs, 1.1 GB, the
  one the FLUX.3 LoRA used); columns cond_image / target_image / instruction (`<mva>` caption) / source. Same
  pairs as akhaliq/qwen21-multiple-angles-train-v2 which is CC-BY-4.0: Dome-Objaverse renders (CC-BY-4.0; the
  source meshes keep per-asset licences), Linzhan rigged characters filtered to CC-BY/CC-BY-SA/CC0, Unsplash
  backgrounds. The flux3 dataset repos carry NO licence tag. Training script public: diffusers
  `train_dreambooth_lora_flux3_klein_img2img.py`; configs in akhaliq/qwen21-multiple-angles-jobfiles.
- Zoom: only fal's Qwen LoRA trains real distances; akhaliq's "close-up" = a 62% centre crop of the target.

akhaliq FLUX.3 angle LoRA test (Fabio's go 2026-10-23; `angles.py <port> lora`, results `out/lora.json`, sheets
`lora_turbo.jpg` / `lora_base.jpg`; seed 111, strength 1.0, raw `<mva> ...` prompts, 4 sources x 8 views, Turbo
~20 s / base ~95 s a run). The diffusers keys load as NOTHING in ComfyUI: `convert_lora.py` renames them to
FLUX.3's native names (mode_blocks->content_mode_blocks, single_transformer_blocks->single_blocks, to_q->q_proj
..., ff.linear_in->mlp_in); engine log then shows no "lora key not loaded". Copy at
`M:\CubricModels\loras\mpi1039\`. Injection needs `Lora_1: {lora_name, strength_model, strength_clip}` - drop
strength_clip and comfyController writes the dict into lora_name (MPI-219 trap).
- TURBO: mostly copies of the input. Hits: face profile + back of head, speaker end view + top view, man's back.
- BASE (what it was trained on) is better at TURNING: front 3/4 lands on all four subjects, side view on face /
  body / speaker - including the SPEAKER, where our prompt recipe never turned it. The 3/4-back-high speaker shows
  top + end with the grille hidden (a real rear view).
- BASE fails: back views (copies, except the man turning), 3/4 back at eye level (lands as 3/4 FRONT), low angle
  (copy on all four), top-down (broken: tiled / upside-down / sweater texture) except the street.
- vs our prompt recipe (Turbo): ours wins on height (low, high, extreme stops on every subject); the LoRA wins on
  object yaw. Neither gets a true back view of a scene (background never swings round).

Rotate a character in a scene (Fabio's go 2026-10-23; `angles.py <port> rotate`, results `out/rotate.json`, sheet
`rotate_scene.jpg`; seed 111, Turbo 1K, ~19 s a run; the scene p1 front source; prompt `TURN` = "his whole body
turned <N> degrees ... Only he has turned: the camera, the framing and the street behind him are exactly as in the
first image" + frame-term consequences per view in `TURNS`). Agent read, awaiting Fabio's eye test:
- THE STREET HOLDS in all 7: red door frame-left, bicycle frame-right, lights, cobbles, framing unchanged (only the
  area he uncovers repaints). Identity held (beard, jacket, bag). Subject rotation in a scene WORKS as a prompt.
- Big turns land: pr L (clean profile facing frame-left, strap nearest), tqb L (good lost profile, but the bag
  strap jumped to his right shoulder), back (true back, strap on frame-left as asked), tqb R (clean), pr R (clean).
- 45-degree turns are weak: tq L = body barely turns and his HEAD looks toward frame-RIGHT (wrong way); tq R =
  near-frontal, a small turn. Same as the body bench: 3/4 front is where the model under-turns.
- So 5/7 pose on one seed, 0 background drift; cut-out fallback NOT needed so far.
- 45-degree rework (Fabio's go; `HALF` = the body bench's FRONT3Q geometry "halfway between facing the camera and
  side-on" + "his head turns with his body ... not toward frame-<other>"; keys `tq L v2` / `tq R v2`, same sheet):
  tq R v2 = clear 3/4 (right shoulder forward, strap away, face + body toward frame-right) PASS. tq L v2 = right
  direction now (head + chest toward frame-left, strap shoulder forward) but a smaller turn, ~30 degrees: PARTIAL.
  Both keep the strap on the correct shoulder; street unchanged. With v2: 6/7 pass + 1 partial on seed 111.
- Seeds 222/333 (Fabio's go; `angles.py <port> rotate_seeds`, keys `scene <view> s<seed>`, sheet
  `rotate_seeds.jpg` = 3 seeds x the 7-view strip with the v2 45s, ~21 s a run). Over 3 seeds, 21 cells:
  | view | pass | note |
  | 3/4 front L (v2) | 1/3 | s222 clean; s111 + s333 PARTIAL (right way, ~30 degrees, face near-frontal) |
  | profile L | 3/3 | |
  | 3/4 back L | 3/3 | pose right; bag strap jumps to his RIGHT shoulder on s111 + s333 |
  | back | 3/3 | strap on frame-left as asked |
  | 3/4 back R | 3/3 | |
  | profile R | 3/3 | |
  | 3/4 front R (v2) | 2/3 | s222 PARTIAL (small turn) |
  17/21 clean + 4 partials, 0 wrong-way, STREET HELD IN ALL 21, identity held. Verdict (agent): rotating a
  character in a scene works with the prompt alone; the cut-out fallback is not needed. The 3/4 FRONT views are the
  weak stop (under-turn), which a seed retry covers; tqb L needs the strap-side wording fixed or dropped.

Turn + height in ONE prompt (Fabio's go 2026-10-23; `angles.py <port> rotate_pitch`, `TURN_H` = the turn + the
scene PITCHES camera/shows + "same street seen from the new camera height, door frame-left, bicycle frame-right";
3 views x 4 heights, seed 111; sheet `rotate_pitch.jpg`, rows tq L v2 / tqb L v2 / back + a strap-fix row).
Agent read, awaiting Fabio's eye test:
- The TURN HOLDS at every height (tq L stays its ~30-degree partial, tqb L stays a lost profile, back stays back),
  identity held, the street stays the same street. One prompt from the front works; no two-step needed.
- HIGH stops land strongly on all 3 views: hi = cobbles behind, door + bicycle from above; xhi = bird's-eye with
  his feet in frame. Clearly distinct from each other.
- LOW stops are WEAK: xlo ~= lo, both only mildly low (taller buildings, balconies, little or no sky). Weaker than
  the pitch-only scene run (`pitch_scene.jpg`), where lo/xlo brought sky + towering fronts. Suspect the new
  "same street, door frame-left ..." anchor line pins the background and damps the low camera.
- STRAP FIX FAILED: `tqb L v2` ("strap stays on his LEFT shoulder, nearer the camera, frame-left") still puts it on
  his right shoulder on s111 + s333 (it lands right on `tqb L v2 hi`). Agent view: drop it - a Flow prompt cannot
  name the user's accessories anyway, so "a one-sided bag / earring may swap sides on 3/4 back views" is a known
  limit, not a wording job.
- Low rework (Fabio's go; `angles.py <port> rotate_low`, `TURN_LO` = TURN_H minus the street-anchor line, keys
  `scene <view> lo|xlo v2`, sheet `rotate_low.jpg` with the pitch-only front lo/xlo as reference; seed 111, 6 runs):
  SMALL GAIN on extreme low only - tqb L xlo v2 and back xlo v2 now show sky top-right and building fronts leaning
  away (old: none); tq L xlo v2 barely changes and tips his head up. lo v2 ~= lo old: a mild "slightly low" either
  way. Still well short of the pitch-only front xlo reference (strong keystoning, sky, towering fronts): a low
  camera lands harder on a FRONT subject than on a turned one. Anchor line confirmed as a damper -> TURN_LO for lows.

Fabio 2026-10-23: prompts must be GENERIC (no man/outfit/street; "the subject"/"they"), must not say
"photograph" (anime would turn photoreal), and should follow the FLUX.3 guide (whole-picture edit = "Shift the
camera viewpoint to ...", only the change, one keep-clause). He asked for TWO passes: turn first, then height on
that result. Rule added to the add-flow playbook + mpi-add-flow skill (read the model guide before any Flow prompt).
- Long generic two-pass (`angles.py <port> two_pass`, G_TURN / G_HEIGHT, `out/twopass.json`, sheet `two_pass.jpg`,
  seed 111): pass 1 turns land as before. Pass 2 FAILS: low + floor = copies (diff 5-6) except tq L floor, which
  pulled back to a full-body ground-level shot (diff 49); high + bird's-eye = the person kept exactly as is and
  the BACKGROUND swapped for cobbles (fake, no foreshortening). Worse than the one-prompt version.
- Short generic two-pass (`short_pass`, S_TURN / S_HEIGHT, ~40-word guide-voice prompts, `out/shortpass.json`,
  sheet `short_pass.jpg`): pass 1 SHORT TURNS WORK as well as the long ones (3/4 front again ~30 degrees, lost
  profile + back clean). Pass 2: ALL 12 are copies (diff 5-7) - the camera never moves.
- Read: on Turbo a second edit of an already-edited picture will not move the camera, whatever the wording (third
  time: p1 two-step, long, short). Untested: the SHORT height prompts straight from the original picture, which
  would tell "short wording too weak" apart from "second pass refuses".

MANNEQUIN REFERENCE idea (Fabio 2026-10-23): picture 2 = a grey mannequin on a dark backdrop at the exact view
(angle, height, ZOOM); the edit asks for picture 1 seen the same way, naming the view in words too (front vs back is
hard to read on a mannequin). The same renders become the gizmo's stop previews. Square 1:1 masters (crop to the
user's ratio later; a crop changes the zoom, so the gizmo may need per-ratio-family renders).
- Refs via FLUX.3 Turbo t2i (`angles.py <port> mannequin`, MQ_BODY + MQ_VIEWS, seed 111, ~13 s each, copies in
  `research/mannequin/*.png`, sheet `mannequin.jpg`): tqb L = a back view barely angled (weak 3/4 rear); back xlo =
  back view at EYE LEVEL (low FAILED); tq L hi = 3/4 front, only mildly high; xhi = high-angle front but not a true
  bird's-eye (looks up); close = good close-up but the mannequin grew a female chest. t2i struggles with the same
  low/high stops. Edits with the refs (`mannequin <port> edits`) NOT run yet.
- Fabio: if t2i cannot make the mannequin views, he will install the Blender CLI and the refs get rendered from a
  real 3D mannequin (exact angle, height, zoom; also the gizmo's own previews).
- Round 2 refs (`angles.py <port> mannequin2`, `out/mannequin2.json`, sheet `mannequin2.jpg`; guide order with the
  camera FIRST, flat shadowless softbox light, "sexless, flat chest"; 4 views x seeds 111/222/333): light is flat now.
  front lo / back lo = moderate upward perspective on s333, mild on 111/222 (never extreme). front hi = good steep
  high on s111; s222/s333 grew a chest again (the sexless words do not hold every seed). "top" (camera words) came
  out as front hi; "top2" (plan view described by what is IN FRAME: crown centred, face hidden) = a TRUE top-down on
  s222 + s333. Picks (MQ_PICK, copies `research/mannequin/front_lo.png` etc.): front lo 333, back lo 333,
  front hi 111, top2 333.
- Two-image edits on the street man (sheet `mannequin2_edits.jpg`, ~31 s each). A = MQ_EDIT ("match the camera of
  image 2"), B = MQ_EDIT_B ("replace the mannequin in image 2 with the subject, same place, size, camera"):
  - ZOOM transfers on every edit: all went from the waist-up source to full body.
  - HIGH works on both wordings: front hi + top2 = camera clearly above, looking down at him and the cobbles. Not a
    true bird's-eye (top2 edit = steep high, face still up) but a solid "high" stop.
  - FRONT LOW fails on both: eye level.
  - BACK LOW: A pasted the MANNEQUIN into the street (subject lost). B = a REAL low back view of the man in his
    street - first time back + low has worked in this card - but he took the mannequin's stiff wide pose, and his
    trousers turned to light jeans and his hair dark.
  - Read: the ref carries zoom + high reliably, back-low only with B, and B leaks the mannequin's POSE (and some
    clothing drift). Open: Fabio's eye test; front low needs a stronger ref (t2i never gives an extreme low) - the
    Blender route would give exact refs and a pose matched to the user's subject is not possible from a fixed set.
- 2026-10-23 ROUND 3, BLENDER REFS (`angles.py <port> blender`, sheet `research/sheets/mq_blender.jpg`, results
  `research/out/mq_blender.json`, refs `research/blender/out/*.png` = Fabio's UE4 mannequin, A-pose, exact cameras).
  Seed 111, FLUX.3 Turbo 1K, street man, three wordings: MQ_EDIT, MQ_EDIT_B, MQ_EDIT_C (B + keep-your-own-pose clause).
  - front lo: FAIL on all three - eye level; B/C only zoom out to full body. An exact low ref does not move the edit.
  - back lo: the TURN lands on all three (back view), camera stays ~eye level; the A-pose arms leak into ALL three,
    C's pose clause did not stop it; MQ_EDIT also greyed his head/hands (mannequin paste).
  - front hi: PASS on all three (looks down on him, framing held).
  - top2: strong high angle, NOT top-down (reads as front hi).
  - Read: Blender refs carry turn + high exactly like t2i refs did; LOW is a model limit of the FLUX.3 edit, not a ref
    problem. A-pose ref = pose leak on back views; a relaxed arms-down ref pose should cut it (rig has CS_ controls).
- 2026-10-24 ROUND 4, NATURAL POSE + CAMERA-ONLY WORDING (`angles.py <port> blender 4`, sheet
  `research/sheets/mq_blender4.jpg`, results `research/out/mq_blender4.json`). Refs rendered from Fabio's hand-posed
  copy `research/blender/out/UE4_Mannequinn_refs.blend` (arms down, feet in). Seed 111, FLUX.3 Turbo 1K, street man.
  Wordings never say "mannequin"/"replace": D leads with "camera reference", E leads with "Move the camera to {v}".
  - front lo: FAIL on both - full body, eye level. NEW artefact: a camera/bag prop lands on the cobbles at his feet
    (E draws an actual camera) - the word "camera" leaks into the picture.
  - back lo: D PASTES the grey mannequin into the street (fail). E turns him to a back view, but his body takes the
    mannequin's slim bodysuit shape (no bag, odd hands) - identity leak instead of pose leak.
  - front hi: PASS on both, and he keeps HIS OWN pose (hands in pockets) - pose leak gone on the front views.
  - top2: D reads as front hi (as round 3); E is the closest top-down yet (more overhead, body foreshortened).
  - Read: camera-only wording fixes the pose copy on front views; E beats D everywhere. Low stays a model limit.
    Back views still pull the mannequin's BODY in. Next wording should drop the noun "camera" (say "viewpoint").
- 2026-10-24 ROUND 5, BFL EDIT VOICE + TURN-THEN-HEIGHT (`angles.py <port> blender5`, sheet
  `research/sheets/mq_blender5.jpg`, results `research/out/mq_blender5.json`, prompts `MQ5` / `MQ5_LOWER_BACK` /
  `MQ5_KEEP`). "Shift the viewpoint of the first image ... to match the mannequin reference in the second image: <view>.
  <where things now sit in the frame>." + keep clause; no "camera". Seeds 111 + 222; new ref `back_eye` (level, behind).
  - front lo: LOW WORKS for the first time in this card - strong worm's-eye on both seeds. 222 = clean pass; 111 gave
    him the mannequin's grey legs and feet (body leak).
  - back lo, one edit: 111 pastes the grey mannequin; 222 = low back view but a grey mannequin head and hands.
  - front hi: PASS both, own pose kept (hands in pockets).
  - top2: 222 = TRUE top-down (crown, shoulders, shoe tips) - first time; 111 = steep high, not overhead.
  - back eye (turn only, eye level): PASS both - clean back view, bag strap, street from the other side.
  - back eye > lo (turn, THEN lower on the turned picture): the height step returns a near COPY on both seeds - same
    as the 2026-10-23 two-pass finding. Turn-first does not unlock the height on the second edit.
  - Read: describing the END STATE in BFL's voice is what moved low + top-down; the ref still leaks its BODY into
    low views (the mannequin fills the frame there). Height on an already-edited back view is the open problem.
- 2026-10-24 ROUND 6, REAL-PERSON KEEP CLAUSE + LINE REFS + HEIGHT-THEN-TURN (`angles.py <port> blender6`, sheet
  `research/sheets/mq_blender6.jpg`, results `research/out/mq_blender6.json`). MQ5 view wordings + `MQ6_KEEP` ("The
  subject is still the real person from the first image, with their own head and hair, hands, clothes and shoes").
  Refs: 'grey' (round 5) and 'line' (`ref_render.py -- outline`: flat light, body the wall's tone, outline + ridges).
  Seeds 111-444.
  - front lo: 8/8 strong worm's-eye, real person, no grey body.
  - back lo, ONE edit: 8/8 low back view, real person - the grey body leak is gone on every seed.
  - top2: 8/8 true top-down (crown, shoulders, shoe tips).
  - grey vs line refs: no visible difference - the keep clause is the fix, not the ref style.
  - front lo > back (height first, then turn): turn lands on 1/4 (333); 111/222/444 return the front view. Two-step
    loses in both orders; ONE edit from the source is the route.
  - Read: recipe = MQ5 view wording (BFL voice, end state) + MQ6_KEEP + exact Blender ref, one edit. Front hi + back
    eye passed in round 5 with the older keep; recheck them with MQ6_KEEP and widen to other sources next.
- 2026-10-24 ROUND 7, RECIPE ON MORE VIEWS + SOURCES (`angles.py <port> blender7`, sheets
  `research/sheets/mq_blender7_{man,woman,face,object}.jpg`, results `research/out/mq_blender7.json`). Seeds 111 + 222.
  New refs in Fabio's copy: `tq_fl/fr/bl/br` (45-degree steps, level, 2.6 m) and head-and-shoulders `face_*` (50 mm).
  - man (street): front hi 2/2, back eye 2/2, 3/4 front L 2/2, 3/4 front R 1/2 (111 zoomed out, under-turned), 3/4 rear
    L 2/2, 3/4 rear R 2/2. The 3/4 views that under-turned in the 2026-10-23 prompt-only bench now land.
  - woman (studio, full body): back eye, all four 3/4, front hi 2/2 each; top2 2/2 strong high, near overhead; front lo
    and back lo 2/2 but milder than the man's (a plain backdrop gives no perspective to lean).
  - face close-up: back 2/2, 3/4 rear R 2/2 (profile), 3/4 front L 2/2 but mild; front lo FAIL 2/2 (eye level), front
    hi weak 2/2. Face heights stay the known limit.
  - object (floating speaker, object wording + MQ7_OBJ_KEEP): front hi 2/2, top2 2/2 partial (top shows, not straight
    down); front lo FAIL 2/2 - PASTES the mannequin holding the speaker; back eye FAIL 2/2 (front still shows); 3/4
    mild. A human ref does not transfer to objects: needs an object stand-in ref (a box) and its own keep.
  - Read: the recipe holds for full-body PEOPLE in a scene or studio at every tested view. Face close-ups: turns yes,
    heights no. Objects: a different ref.
- 2026-10-24 ROUND 8, BASE FLUX.3 + NEGATIVE + YELLOW BOX STAND-IN (`angles.py <port> blender8`, sheets
  `research/sheets/mq_blender8_{man,woman,face,object,box}.jpg`, results `research/out/mq_blender8.json`). Turbo off (50
  steps, cfg 3.5, ~150 s an edit vs ~40 s) so `negative` is live: against the grey mannequin body/pose (people) and the
  mannequin + stand-in (objects). Box stand-in = `blender/obj_build.py` (yellow, white front panel + black disc, dark
  tab on its frame-right end). Same seeds as round 7 (111, 222), so each sheet carries round 7's Turbo rows.
  - man: front lo / back lo 2/2 a VERY low worm's-eye that crops his head out (over-shoots); top2 FAIL 2/2 (a copy) -
    round 6 Turbo was 8/8 true top-down. Base loses.
  - woman: front lo 111 odd (bent forward, a second person's arms behind her), 222 a copy; back lo 2/2 mild. Worse
    than round 7 Turbo.
  - face: front lo 111 slight, 222 none; front hi none. No better than Turbo.
  - object + mannequin ref: front lo still PASTES the mannequin 2/2 despite the negative; the rest are near copies.
  - object + box ref: the stand-in is PASTED (front lo, front hi, tq fl on 111; front hi 222 stacks a second box);
    back eye 222 is a TRUE BACK (plain black back, strap mirrored to frame-left) - the box does carry the turn; 111
    back eye paints the yellow back onto the speaker. The negative does not stop a paste.
  - Read: base + negative is not a lever - Turbo stays. A stand-in of a different look than the object gets pasted;
    the box ref carries the yaw at least once. Round 9: a bottle (Fabio: a fairer rotation test), Turbo, three arms -
    stand-in / outline stand-in / no ref.
- 2026-10-24 ROUND 9, PERFUME BOTTLE + THREE OBJECT ARMS, TURBO (`angles.py <port> blender9`, sheets
  `research/sheets/mq_blender9_{bottle,speaker}.jpg`, results `research/out/mq_blender9.json`). Bottle source =
  `BOTTLE_SOURCE` t2i (frosted pink flask, label front, plain back + a small sticker); bottle stand-in =
  `obj_build.py -- bottle`. Arms: 'ref' (yellow stand-in), 'line' (its outline render), 'prompt' (no ref). Seeds
  111 + 222, six views.
  - ref (solid yellow): PASTED into front lo / front hi / 3/4 on most cells (both sources); back eye a true back on
    1/2 each. Not usable.
  - line (outline stand-in): speaker back eye 2/2 TRUE BACK (plain dark back, strap mirrored to frame-left); bottle
    back eye 1/2 (label gone). front lo 2/2 both (the object tilts to show its underside); front hi 1/2 good, 1/2 a
    faint ghost box under it; 3/4 front mild-to-good, a faint outline circle sometimes painted on the bottle's side.
  - prompt (no ref): bottle back eye 0/2 (label stays); speaker back eye 2/2 but repaints the back green; front lo
    tilts 2/2; 3/4 front plausible.
  - All arms FAIL top2 (a slightly high copy) and the 3/4 REAR (the front still shows).
  - Read: for objects the OUTLINE stand-in is the ref - it carries the back view without pasting; heights tilt the
    object (reads as the view). Open: top-down and rear 3/4. Round 11 = pass rate on 4 seeds vs an outline
    mannequin, flat-lay wording for top2, back-then-45 two-step for the rear 3/4.
- 2026-10-24 ROUND 10, FACE CLOSE-UP HEIGHTS AGAIN (`angles.py <port> blender10`, sheet
  `research/sheets/mq_blender10_face.jpg`, results `research/out/mq_blender10.json`). Steeper refs (`face_build.py`:
  face_xlo ~40 deg below, face_xhi ~45 deg above), wording adds "keeps looking straight ahead, past the view"; arms
  xref / ref (round 7) / prompt; Turbo, seeds 111-444.
  - lo: xref 2/4 mild, ref 1/4 mild; prompt 2/4 STRONG but as a HEAD TILT (chin raised, looking up) - not a camera
    move. hi: 0/4 on every arm (prompt 2/4 tucks the chin and looks up into the lens).
  - Read: on a close-up the model turns a height change into a head tilt; the gaze clause is ignored; steeper refs
    do not help. Close-up heights stay unsolved by one edit. Round 12: zoom out -> body height recipe -> zoom in.
- 2026-10-24 ROUND 11, OBJECT PASS RATE ON 4 SEEDS (`angles.py <port> blender11`, sheets
  `research/sheets/mq_blender11_{bottle,speaker}.jpg`, results `research/out/mq_blender11.json`). Turbo, seeds
  111-444. Arms: 'line' (outline stand-in), 'mline' (outline MANNEQUIN, Fabio's idea); top2 in flat-lay wording;
  '2step' = line back view, then 45 degrees on round with the tq_bl outline ref.
  - speaker, line: back eye 3/4 TRUE BACK (444 an end-on view); 3/4 front 3/4 (strap end nearer, right way; 222 pastes
    the disc); front lo 4/4 (tilts); 3/4 rear 0/4 (the grille still faces the view); top2 0/4.
  - bottle, line: back eye 2/4 (label gone); front lo 4/4; front hi 3/4; 3/4 front 4/4 turn but the outline's DISC is
    painted on the bottle's side as a faint circle; 3/4 rear 1/4; top2 0/4.
  - mline (mannequin outline) on objects: worse on every view (back 0/4 bottle) - the stand-in wins.
  - 2step rear 3/4: lands a back view 3/4 speaker, 2/4 bottle, but the 45-degree angle on only ~1/4 each.
  - Read: objects with the outline stand-in in one edit: low, high, back, front 3/4 work at 50-100%. Rear 3/4 and
    top-down do not, with generic wording. Round 13: object-SPECIFIC end states (an agent can write them in the Flow).
- 2026-10-24 ROUND 12, FACE HEIGHTS BY ZOOM OUT -> BODY RECIPE -> ZOOM IN (`angles.py <port> blender12`, sheet
  `research/sheets/mq_blender12_face.jpg`, results `research/out/mq_blender12.json`). Turbo, seeds 111-444.
  - zoom out (no ref): 4/4 a clean waist-up view, same person and light.
  - height on the waist-up (body wording + MQ6_KEEP + full-body ref): lo 0/4 (copies); hi 1/4 a true high view (333,
    whole body from above), 444 bows her head, 2/4 copies.
  - zoom back in: 0/8 - returns its input unchanged.
  - Read: dead end. A plain-backdrop portrait gives the model nothing to lean; the zoom-in edit does not move. Face
    close-up heights are a model limit at this point - the Flow should offer TURNS ONLY on a close-up (Fabio's call).
- 2026-10-24 ROUND 13, OBJECT-SPECIFIC END STATES - BREAKTHROUGH FOR OBJECTS (`angles.py <port> blender13`, sheets
  `research/sheets/mq_blender13_{speaker,bottle}.jpg`, results `research/out/mq_blender13.json`). The end state names
  the object's own parts (as the Flow's agent would write after seeing it): top2, back eye, 3/4 rear. Arms 'line'
  (outline stand-in) and 'prompt'. Turbo, seeds 111-444.
  - speaker, line: top2 4/4 TRUE TOP-DOWN (top face + three buttons, strap at frame-right); back eye 4/4 (plain dark
    back, strap at frame-left); 3/4 rear 4/4 (strap end nearest at frame-left, back running away). Colours true.
  - speaker, prompt: top2 4/4, back 4/4, rear 3/4 4/4 in angle, but REPAINTS the body green on 3/4 back + 2/4 rear.
  - bottle, line: top2 4/4 (cap octagon centred; 444 shows a sliver of label); back 4/4 (label gone, 333 a faint
    shadow through the frosted glass); 3/4 rear 4/4 (side + back, label hidden). bottle, prompt: same 4/4s.
  - Read: the generic wording, not the model, was the limit. OBJECT RECIPE = one edit, end state naming the object's
    own parts, + the OUTLINE stand-in ref (keeps colours). Round 14 = every view on both objects with this wording and
    the panel-only outline (`ref_render.py -- outline nodisc`: round 11 painted the disc on the bottle's side).
- 2026-10-24 ROUND 14, OBJECT RECIPE ON EVERY VIEW (`angles.py <port> blender14`, sheets
  `research/sheets/mq_blender14_{speaker,bottle}.jpg`, results `research/out/mq_blender14.json`). Object-specific end
  states (`MQ14_VIEWS`) + the PANEL-ONLY outline stand-in (`ref_render.py -- outline nodisc`), one edit, Turbo, seeds
  111-444, nine views.
  - speaker 34/36: front lo 4/4 (underside + feet), front hi 4/4 (top + buttons), top2 4/4, back eye 4/4 (plain back,
    strap at frame-left), back lo 3/4 (222 muddled), 3/4 front L 4/4, 3/4 front R 4/4, 3/4 rear L 4/4, 3/4 rear R 4/4.
  - bottle 32/36: front lo 3/4 (222 near copy), front hi 4/4, top2 4/4 (cap octagon), back eye 4/4, back lo 2/4 (222
    stacks a second bottle, 444 label shows), 3/4 front L/R 4/4 each, 3/4 rear L 4/4, 3/4 rear R 3/4 (444 label shows).
  - no disc painted on any side now (round 11's artefact gone).
  - Read: OBJECT RECIPE CONFIRMED, 66/72 (92%) over nine views and two unlike objects. Weakest view = back lo.
- 2026-10-24 ROUND 15, FACE HEIGHTS BY NAMING WHAT NEWLY SHOWS - BREAKTHROUGH FOR CLOSE-UPS (`angles.py <port>
  blender15`, sheet `research/sheets/mq_blender15_face.jpg`, results `research/out/mq_blender15.json`). Round 13's
  lesson on the face: the end state brings in the studio the new view reveals (lo: "the studio ceiling with a softbox
  light now shows instead of the grey backdrop"; hi: "the grey studio floor now fills the background"). Arms xref
  (steep face refs) / prompt. Turbo, seeds 111-444.
  - xref lo 4/4 TRUE LOW VIEWS (ceiling + softbox behind her, under-chin perspective, head near upright); prompt lo
    4/4 but leans more on a head tilt.
  - xref hi 4/4 moderate-to-good high views (hair parting large, face foreshortened, she looks up into the view);
    prompt hi 4/4 similar.
  - Read: close-up heights WORK when the end state names what the new view reveals behind the subject. One rule now
    covers people, faces and objects: one edit, an exact ref, an end state that names the specific things now in
    view. Round 16 checks it off the studio (a man's close-up outdoors).
- 2026-10-24 ROUND 16, THE FACE RULE OFF THE STUDIO (`angles.py <port> blender16`, sheet
  `research/sheets/mq_blender16_manface.jpg`, results `research/out/mq_blender16.json`). New source: a man's
  head-and-shoulders in an old-town street (`STREET_FACE_SOURCE`, t2i). Steep refs; the end state names what the view
  reveals (lo: upper floors leaning in + open sky; hi: the cobbles fill the background). Turbo, seeds 111-444.
  - lo 4/4 true low views (house fronts lean inward, sky above, underside of beard and jaw); hi 4/4 strong high views
    (cobbled street fills the background, looking down on him); 3/4 front L 4/4.
  - Read: the rule generalises off the studio. Close-up heights are SOLVED in one edit.
- 2026-10-24 ROUND 17, ONE GENERIC STAND-IN FOR UNLIKE PRODUCTS + ZOOM (`angles.py <port> blender17`, sheets
  `research/sheets/mq_blender17_{sneaker,mug,headphones,handbag}.jpg`, sources `mq_blender17_sources.jpg`, refs
  `mq_blender17_refs.jpg`, results `research/out/mq_blender17.json`). Fabio: rounds 13-14 gave each product a stand-in
  of its own shape at one distance, so they did not prove the Flow. Here ONE plain cube (`obj_build.py -- cube`, outline
  render) for four new t2i products (sneaker on a floor seen side-on, mug close-up on a table, floating headphones,
  handbag small in a boutique); end states written after looking at the sources (as the Flow's agent would); keep
  clause = MQ17_KEEP (the setting, not a frozen background). Zoom = same camera, lens x1.8 (near) / x0.55 (far), on front
  hi and tq fl. Turbo, seeds 111-444. FIRST READ (agent, thumbnails - Fabio's eye test pending):
  - front lo ~2/16 - FAILS on products that REST on something (near copies); rounds 13-14 passed it on floating
    objects because the underside was there to show.
  - front hi 13/16 (headphones weak); top2 10/16 (headphones 0/4, handbag reads high, not straight down); back eye
    12/12 judgeable (headphones are symmetric - front and back cannot be told apart); tq fl 13/16 (mug barely turns);
    tqb r 15/16.
  - ZOOM WORKS: near 31/32, far 31/32 (one headphones near took the ref's grey backdrop, one handbag far lost the room).
  - Read: the generic cube carries turns, back, high and zoom across unlike shapes; resting-object LOW views and
    top-down on thin/symmetric shapes are the gaps. Next ideas: low wording that names the surface edge filling the
    foreground + what rises behind; the HOUSE stand-in (roof = up, door = front) for top-down and left/right.
