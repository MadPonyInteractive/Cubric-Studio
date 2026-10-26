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
- 2026-10-24 3D COSMO (gizmo preview model) - FABIO EYE TEST PASS. `blender/cosmo_build.py` -> `out/cosmo.blend`, rendered
  front_hi / front_lo / tq_br / top2 to `out/cosmo/`. Two fixes on the way: bevels on every box (widths from his earlier
  10:37 build, which a rerun of the script had overwritten) and the art decals excluded from Freestyle (their square plane
  borders drew a hard wireframe over the rounded head/torso). Open: top2 has nothing marking "top".
- 2026-10-24 ROUND 18, HOUSE STAND-IN + SURFACE-LEVEL LOW WORDING (`angles.py <port> blender18`, sheets
  `research/sheets/mq_blender18_{sneaker,mug,headphones,handbag}.jpg`, results `research/out/mq_blender18.json`). Round
  17's sources; house on a plinth (`obj_build.py -- house`, outline render); MQ18_LOW lowers the camera to the surface for
  the three resting products; `cube lo` = the same low words on round 17's cube ref. 112 Turbo edits, ~33 s each.
  FIRST READ (agent, thumbnails - Fabio's eye test pending):
  - THE HOUSE GETS PASTED on the plain-backdrop product: headphones show a grey house/plinth in 7/24 cells (front hi x2,
    top2, back eye x2, front lo x2). The cube was pasted ~once in round 17. On busy real settings (sneaker, mug,
    handbag) the house was never pasted. A more distinctive stand-in = more to copy.
  - Low: house lo and cube lo look the same in every product -> the WORDING moves it, not the ref. Sneaker 4/4 lower
    (the source was already near floor level, so modest); handbag 4/4 at plinth level but 3/4 reshaped the ROUND plinth
    into a square slab (both arms - "seen edge-on as a thin line" did it); mug ~2/4 per arm (rest near copies).
  - top2: still not straight down - sneaker 4/4 good, mug ~2/4, handbag reads high (plinth circle, bag front showing),
    headphones 0/4 again. The house's roof/chimney did not buy top-down.
  - Turns (back eye, tq fl, tqb r) hold as in round 17: sneaker/handbag ~4/4, mug back + tqb ok, tq fl weak (barely
    turns); headphones tq good, back eye unjudgeable (symmetric).
  - Read: keep the CUBE (house pastes, gains nothing); keep the surface-level low words for resting products but drop
    "edge-on thin line" for named surfaces (it reshapes them); top-down needs another idea (straight-down wording without
    a ref, or a two-step high -> top).
- 2026-10-24 ROUND 19, PEOPLE TESTS (`angles.py <port> blender19`, sheets `research/sheets/mq_blender19_{man,woman,face,zoom}.jpg`, results `research/out/mq_blender19.json`; each sheet shows all 4 seeds, rounds 6-7 cells filling 111/222).
  84 Turbo edits. Zoom refs = `blender/zoom_build.py` (lens twins on a copy of the posed file) -> out/{front_hi,tq_fl}_{near,far}.png.
  FIRST READ (agent, thumbnails - Fabio's eye test pending):
  - man (street, waist-up source): EVERY view 4/4 - front lo, back lo, top2 (true top-down), front hi, back eye, all four 3/4.
  - woman (studio, full body): back eye, front hi, all four 3/4 4/4; top2 4/4 steep high, ~2/4 truly overhead; plain
    front lo / back lo 4/4 but mild (as round 7).
  - woman studio LOW with the reveal (ceiling + softbox named): 4/4 front and back - the ceiling rig and softbox show
    above her and the low reads clearly stronger than the plain wording. Round 15's rule holds on full body.
  - face turns: woman back 4/4, tq fl 4/4 (444 mild), tqb r 4/4 but lands nearer a PROFILE than a 3/4 rear (as round 7);
    street man close-up back 4/4 (street seen reversed), tqb r 4/4 same profile lean.
  - ZOOM, man (street): near 8/8 (front hi crops tighter, tq fl goes waist-up); far 6/8 (front hi far 222/444 ~ no change,
    tq fl far 4/4 small in a longer street).
  - ZOOM, woman (plain studio): front hi near 4/4; front hi far ~2/4; tq fl near AND far 0/8 - near and far come out the
    same full-body frame and the 3/4 turn itself goes weak. A plain backdrop gives nothing to scale against.
  - Read: full-body people PASS on 4 seeds at every view in a real place; on a plain studio, low needs the reveal rule
    and zoom is unreliable (next idea: name what a far view reveals - the backdrop's edge, light stands, studio floor -
    and what a near view crops at, e.g. "cropped at the waist"). Rear 3/4 on close-ups over-turns to profile.
- 2026-10-24 ROUND 20, REF PADDED TO THE SOURCE SIZE + OUTPUT AT THE SOURCE SHAPE (`angles.py <port> blender20`, sheets
  `research/sheets/mq_blender20_{turns,zoom}.jpg`, results `research/out/mq_blender20.json`). Fabio: same size helps.
  Square ref scaled to the source width, edge pixels padded to its height (Resize Image v2 pad-edge-pixel stand-in);
  man 4:5 (896x1088), woman 9:16 (768x1344, rounds 7-19 edited her at 4:5). Round-19 prompts and seeds; 48 Turbo edits.
  - man: matched ~= round 19 cell for cell (same seed, near-identical pictures) - turns and zoom unchanged; 3/4 turns
    still under-turn the body (head turns, chest stays square-ish).
  - woman: now full frame at 9:16; front hi near no longer crops (round 19's 4:5 crop had faked "closer"), so near
    and far look alike; tq fl near/far still barely differ and barely turn.
  - Read: the ref's shape is NOT the zoom lever. Keep the size rule for the Flow (no harm, one less variable), but a
    lens-twin ref is an absolute framing while a zoom is relative to the source. Round 21: zoom in words only.
- 2026-10-24 ROUND 21, ZOOM IN WORDS, NOT IN THE REF - BREAKTHROUGH FOR ZOOM (`angles.py <port> blender21`, sheet
  `research/sheets/mq_blender21_zoom.jpg`, results `research/out/mq_blender21.json`). Plain view ref padded to the source
  size + view end state + a zoom sentence RELATIVE to the source naming the crop (near) or what newly shows (far:
  house fronts full height + more street; the studio's backdrop edges, light stands, softboxes, bare floor). Rows
  alternate round 20 (lens-twin ref) / words. 32 Turbo edits.
  - woman far: front hi 4/4, tq fl 4/4 - small in the middle, the whole studio rig around her (lens ref: ~0/8).
  - woman tq fl near: 4/4 clearly closer (cropped thigh-to-waist, not exactly the waist). front hi near: ~1/4 - the
    high view is already close; little change.
  - man tq fl near 4/4 (head-and-chest), tq fl far 4/4 (whole body small, shoes in frame); front hi far 3/4 (222 mild);
    front hi near ~= the lens ref (already close).
  - Read: zoom = words relative to the source + round 15's reveal rule; the zoom stop needs NO ref of its own (the Flow
    ships one ref per view, not per zoom stop). Gap: "closer" on a view that is already close (front hi).
- 2026-10-24 ROUND 22, SUBJECT-SPECIFIC 3/4 FRONT TURNS (`angles.py <port> blender22`, sheet
  `research/sheets/mq_blender22_turns.jpg`, results `research/out/mq_blender22.json`). Fabio (round 19): the male side view
  is weak. End states naming their own things (strap shoulder nearest, far arm half hidden, house fronts running away
  at a slant; her watch/hoop or bag side nearest). Padded refs, source shape. 16 Turbo edits.
  - No gain: specific ~= generic cell for cell. The man turns his head and maybe 15-20 degrees of chest; the street
    never swings. The woman turns ~10-20 degrees.
  - CORRECTION to rounds 7/19 "4/4" on 3/4 FRONT views: by the bar Fabio applies, they are MILD (well short of 45).
    Rear 3/4 and back views do land. Open problem: front 3/4 turn strength on full-body people. Ideas (untested):
    an overshoot ref (camera 60-70 degrees round) to land ~45; or turn via the side (90) view.
- 2026-10-24 ROUND 23, FLAT 2D ANIME SOURCE IN A PLACE (`angles.py <port> blender23 street 222`, sheets
  `research/sheets/mq_blender23_{sources,street,anime}.jpg`, results `research/out/mq_blender23.json`). Source: the
  round-7 woman -> Krea2 krea2Edit Turbo + Retro Anime style (styleSelect 6) = 'anime 111' -> Krea2 again put her on a
  sunny Japanese shopping street (Fabio: a place is the harder test) = 'street 222', 768x1360. The LoRA's purple pulls
  hard (red hair, purple jeans). People recipe, MQ23_KEEP ("same drawn anime woman ... stays a drawing, not a photo"),
  refs padded to 768x1360, 9:16. 4 Krea2 + 20 FLUX.3 Turbo edits.
  FIRST READ (agent, full-size crops - Fabio's eye test pending):
  - DRAWING STYLE HELD 20/20 - no cell drifted toward a photo. The 2D keep clause works.
  - front hi 4/4 (steep down, the purple street fills behind her); front lo reveal 4/4 STRONG (huge sneakers, legs
    rising, sky + power lines, shop fronts leaning in; 111 crops her head at the top).
  - back eye: she faces away 4/4, but 333 + 444 PASTE THE MANNEQUIN (bald orange head, jointed arms and legs) - 2/4
    clean. Never seen on the photo people (rounds 6-22). The flat drawing seems to let the grey mannequin's shape through.
  - tqb r: rear 3/4 right 4/4 on her.
  - THE PLACE DOES NOT MOVE on the turns: back eye, tqb r and tq fl far keep the street pixel-for-pixel (vending machine
    still left, same signs) - she turns on the spot, the camera never goes round. 0/12. On the photo street man (round
    19) the back view showed the street reversed. Height views (hi, lo) do redraw the place.
  - tq fl far: ~1/4 - she is a little smaller and turns ~15 degrees; no wider street (444 the best).
  - Read: a flat 2D source keeps its style and gets the HEIGHT views; turns move the character but freeze the place, and
    the back view can paste the mannequin. Ideas: name what the place now shows from behind (round 15's reveal rule for
    turns: "the street now runs the other way, the vending machine on her right"), and the line/outline ref instead of
    the shaded grey mannequin for 2D sources.
- 2026-10-24 ROUND 24, FABIO'S UNISEX DOLL REPLACES THE UE MANNEQUIN (`angles.py <port> blender24`, sheet
  `research/sheets/mq_blender24_doll.jpg`, results `research/out/mq_blender24.json`). Fabio: the UE mannequin ruins the
  back shots. His ControlNet doll (Body_Full_01, `D:\Blender\Projects\OpenPoseBonse_V99\mpi_openPose.blend`, natural
  pose, his OBJ export -> `blender/out/doll.obj`) dropped into the same ref scene by `blender/doll_build.py` (fitted to
  the mannequin's height x1.07 + footprint, skin tone 0.80/0.56/0.43 at Fabio's ask) -> `out/doll_refs.blend`,
  `ref_render.py` -> `out/doll/<cam>.png`. Same words and seeds as rounds 7/19/23; 20 FLUX.3 Turbo edits.
  - anime back eye: 4/4 CLEAN - real red hair, the bag at her side; round 23's mannequin paste (333, 444) is gone.
  - anime tqb r 4/4, anime front lo reveal 4/4 (as strong as the grey mannequin).
  - photo woman back eye 4/4, tqb r 4/4 - clean, the bag strap now crosses her back. No skin or nude body pasted anywhere.
  - Unchanged: the 2D street still does not move on the turns (round 23's open problem - a wording issue, not the ref).
  - Read: THE DOLL IS THE PEOPLE REF from now on (no seams/joints/bald dome to copy); re-render other stops from
    doll_refs.blend when they are next used. Pose change = Fabio re-poses in his file and re-exports the OBJ.
- 2026-10-24 ROUND 25, TURN-REVEAL WORDING ON THE 2D STREET (`angles.py <port> blender25`, sheet
  `research/sheets/mq_blender25_turn_reveal.jpg`, results `research/out/mq_blender25.json`). Round 15's reveal rule
  applied to turns: the end state names what the PLACE shows from the new side, read off street 222 in FRAME terms (the
  vending machine is frame-left = HER right; "her right" alone mirrors). Doll refs, MQ23_KEEP, 12 FLUX.3 Turbo edits.
  FIRST READ (agent, full-size crops - Fabio's eye test pending):
  - THE STREET MOVES NOW. back eye 4/4: street seen from the other end - vending machine + blue awning frame-right, pink
    awning + yellow sign board frame-left, bag on her right side; round 24 kept the source street 4/4. It reads as the
    source street mirrored (same props swapped over) more than a new stretch of street.
  - tqb r 4/4: shop fronts with the yellow sign board seen at a slant, street running off to one side, vending machine
    gone; round 24 kept the source street 4/4. She lands near rear profile (her face turned to frame-right), as before.
  - tq fl 4/4 on the place: vending machine + blue awning behind her at frame-left, the street running away to
    frame-right, the pink side gone. Her BODY still turns only ~15-20 degrees (the known weak 3/4 front turn).
  - Drawing style held 12/12; no doll pasted.
  - Read: on a 2D source the turn's place has to be NAMED from the new side; the plain "seen from that angle" clause
    freezes it. Flow consequence: the agent reads the place's landmarks off the source and writes them per view, in
    frame terms. The 3/4 front body turn is still the open weak view (overshoot ref next).
- 2026-10-24 ROUND 26, OVERSHOOT REF FOR THE 3/4 FRONT TURN (`angles.py <port> blender26`, sheet
  `research/sheets/mq_blender26_overshoot.jpg`, results `research/out/mq_blender26.json`). The doll seen from 65 and 80
  deg instead of 45 (`blender/overshoot_build.py` -> `out/doll_overshoot.blend` -> `ref_render.py` ->
  `out/doll/tq_fl_{65,80}.png`), the 45-deg words unchanged: anime street (round 25 reveal words, MQ23_KEEP) and photo
  woman (round 7 words, MQ6_KEEP), 4 seeds = 16 FLUX.3 Turbo edits; 45-deg cells (round 25, rounds 7+19) above.
  FIRST READ (agent, full-size crops):
  - OVERSHOOT DOES NOTHING. anime 65 and 80 = the 45-deg cells almost pixel for pixel (same ~15-20 deg turn, same
    street). 0/8.
  - photo 65 and 80 turn LESS than the 45-deg cells (she squares up to the camera) and frame tighter. 0/8.
  - Read: the 3/4 front turn's size is not taken from the ref angle - the edit holds the source's frontal pose and
    the words decide. A bigger ref swing buys nothing. Next idea, if pursued: overshoot in the WORDS (e.g. "seen from
    her side, nearly in profile") with the 45-deg ref, or accept the mild 3/4 front as the Flow's 3/4 stop.
- 2026-10-24 ROUND 27, THE OVERSHOOT IN THE WORDS (`angles.py <port> blender27`, sheet
  `research/sheets/mq_blender27_turn_words.jpg`, results `research/out/mq_blender27.json`). Fabio: put the overshoot in
  the prompt, as zoom was (round 21). 45-deg doll ref; end state = camera gone a long way round to her left, body almost
  side-on facing frame-left, left shoulder/arm/hip/leg nearest, right shoulder hidden, feet to frame-left, face in
  three-quarter profile (`_TURN27`); anime keeps round 25's street reveal sentence. 8 FLUX.3 Turbo edits.
  (Round 26's 65/80 refs kept the 45-deg camera's distance and lens - the doll was the same size, not further away;
  every doll ref is that small in frame, a separate question.)
  FIRST READ (agent, full-size crops):
  - THE WORDS MOVE THE TURN. Direction right everywhere (she faces frame-left, as the doll does).
  - anime: 4/4 turn a lot - but OVERSHOOT to full profile (~90 deg) on 111/222, ~70 on 333/444. Past three-quarter.
    Street reveal kept (vending machine behind her at frame-left). Style held.
  - photo: 111 near profile, 444 a clear three-quarter, 222 + 333 ~30 deg (more than the old ~15-20). 4/4 better than
    the 45-deg words, 2/4 a real three-quarter.
  - Read: the turn's size is set by the words, not the ref angle. "Almost side-on" lands at profile on the 2D source and
    at three-quarter-ish on the photo. Next: a middle wording (drop "almost side-on" / "long way round", keep the
    near-side body parts + "far shoulder partly hidden") to land at 45 on both - or use this wording as a SIDE stop.
- 2026-10-24 ROUND 28, A MIDDLE TURN WORDING (`angles.py <port> blender28`, sheet
  `research/sheets/mq_blender28_turn_middle.jpg`, results `research/out/mq_blender28.json`). `_TURN28` = round 27's end
  state without "a long way round" / "almost side-on": seen in a three-quarter view from her left, body turned about
  halfway toward frame-left at 45 deg, near-side body parts kept, far shoulder PARTLY hidden, face in three-quarter.
  45-deg doll ref, same sources/keeps/seeds as round 27. 8 FLUX.3 Turbo edits (~32 s each).
  FIRST READ (agent, full-size upper-body crops, 45 words | r27 side | r28 middle):
  - REGRESSED. anime 4/4 and photo 4/4 land back on the old mild ~15-20 deg turn, near pixel-for-pixel the 45-deg-words
    cells; round 27 turned far more on every seed.
  - Read: FLUX.3 answers the turn wording in two settings, not a dial - "three-quarter" words = the mild turn,
    "side-on" words = the big one. Round 27's `_TURN27` STAYS the 3/4 front wording (reverted, per Fabio's rule); on the
    2D source it lands near profile, so the Flow's 3/4 front stop may need its own per-style words later.
- 2026-10-24 ROUND 29, THE QWEN-IMAGE 2.1 RE-RUN (`angles.py <port> blender29`, sheet `research/sheets/mq_blender29_qwen.jpg`,
  results `research/out/mq_blender29.json`). The people recipe as of round 28 - doll refs, each view's best words (2D
  street reveal words, round 27's side words for tq fl, the reveal lows) - on `qwen-image-2-1` edit with NO ratio/tier
  (the API refuses a tier alone; without both the edit keeps image 1's frame). 5 views x anime + photo x seeds 111/222 =
  20 edits, ~50 s each (vs FLUX.3 Turbo ~32 s). FLUX.3 cell on the same seed + words beside each.
  FIRST READ (agent, full-size strips):
  - LOW (front lo reveal): QWEN WINS 4/4 - a true ground-level worm's-eye (huge sneakers, legs towering), stronger than
    FLUX.3's; street kept on anime, studio ceiling + softboxes shown on photo.
  - QWEN TAKES THE REF'S ROOM: ~9/20 cells swap the place for the doll ref's dark grey studio (anime 111 front hi,
    222 tqb r, 222 tq fl half; photo 111 tqb r + tq fl, 222 back eye + tqb r + tq fl) or a plain floor (anime 222 front
    hi). FLUX.3 held the place in all 20. Qwen also pulls the camera back (subject smaller) on the photo.
  - tq fl (side words): Qwen lands full profile on all 4 (overshoots more than FLUX.3); FLUX.3 photo 222 a real 3/4.
  - High: both move up; Qwen's anime loses the street, photo goes further back. Identity + 2D style held on both.
  - Read: per-view, not per-model - Qwen owns the LOW stop, FLUX.3 the turns, back and high. Fabio 2026-10-24: a
    Qwen + FLUX.3 blend is fine, as the Character Sheet Editor routes each change to its winning model (operationBy).
    Untested fix for Qwen's room paste: a doll ref on a flat/neutral background, or a keep line naming the place.
  - FABIO 2026-10-24 (eye test on mq_blender29_qwen): the split is right - LOW on Qwen-Image 2.1; turns, back and high
    on FLUX.3.
- 2026-10-24 ROUND 30, QWEN PLAIN REF + LOW ON A TURNED VIEW (`angles.py <port> blender30`, sheets
  `research/sheets/mq_blender30_qwen_plain.jpg` + `mq_blender30_turn_then_low.jpg`, results `research/out/mq_blender30.json`).
  New refs: `blender/plain_build.py` on `doll_refs.blend` -> low twins `tq_fl_lo` / `tq_br_lo` (front_lo's 0.15 m height,
  1.8 m, 25-deg tilt at the turned angles) and, with `-- plain`, every camera with the floor and walls hidden, rendered
  on transparency and flattened onto white -> `out/doll_plain/` (Workbench ignores world.color: it rendered flat dark
  grey). 28 Qwen-Image 2.1 edits, ~55 s each.
  (a) PLAIN REF, round 29's 20 edits again:
  - Qwen copies the REF'S BACKGROUND, whatever it is: the room paste drops from ~9/20 to 4/20, but those 4 (anime 222
    tqb r + tq fl, photo 111 tqb r + tq fl) now go to a WHITE backdrop instead. Fixed: photo 222 back eye/tqb r/tq fl
    (grey backdrop kept), anime 111 front hi (purple ground back, street still not shown).
  - The low stop holds 4/4 with the plain ref (same strong worm's-eye, place kept). The plain ref costs it nothing.
  (b) FLUX.3 TURN, THEN QWEN LOW (`_lo30` words: keep the same side view, drop to just above the floor, name what shows
      above her), plain low-twin ref:
  - 8/8 PASS. A real ground-level low on every turned view; the turn side is kept (tq fl still faces frame-left,
    tqb r still from behind-right); the place kept and revealed (street + sky + power lines on anime; studio ceiling +
    softbox on photo); identity + anime style held. One flaw: anime 222 tq fl crops her head off the top (1/8), anime
    111 tq fl has it at the very edge.
  - Read: the split chains. A low on a turned stop = two edits (FLUX.3 yaw, then Qwen pitch), as Fabio's slider rule
    already says (both sliders moved = two edits). Qwen's ref-background copy matters little in the split: Qwen only
    runs the low stop, where it keeps the place. Use the plain refs for Qwen. Head crop: maybe add "her whole head
    still in frame" to the low words.
- 2026-10-24 ROUND 31, THE SPLIT ON THE OTHER TURNED STOPS + HIGH ON A TURN (`angles.py <port> blender31`, sheets
  `research/sheets/mq_blender31_turn_then_low.jpg` + `mq_blender31_turn_then_high.jpg`, results
  `research/out/mq_blender31.json`). New refs from `blender/plain_build.py`: low twins for all four 3/4 cams
  (tq_fr_lo / tq_bl_lo new) and high twins tq_fl_hi / tq_br_hi (front_hi's 2.6 m / 1.6 m / 47-deg down at the turned
  angle). 16 FLUX.3 Turbo (~34 s) + 12 Qwen-Image 2.1 (~55 s) edits, seeds 111/222, anime street 222 + photo woman.
  FIRST READ (agent, sheets + upper-half crops):
  - (a) MIRRORED TURNS WORK: tq fr (round 27's side words, left<->right) faces frame-right 4/4, the same big turn as
    tq fl; tqb l (round 25 / round 7 rear words mirrored) is on the correct side 4/4 - profile toward frame-left, where
    round 25/24's tqb r faces frame-right. The anime street follows the mirrored landmark words (vending machine gone
    on tq fr, on the right behind her on tqb l). Style + identity held 8/8.
  - (b) TURN THEN QWEN LOW = 12/12: a real ground-level worm's-eye on tq fr, tqb l and back, the turn side kept, the
    place revealed (sky + power lines + signs on anime; studio ceiling + softbox on photo). With 'her whole head still
    in frame' no head is cut off (round 30: 1/8); 2/12 (anime 222 tq fr, photo 222 tq fr) have the hair touching the top
    edge. Together with round 30: the split's low holds on all five non-front stops, 20/20.
  - (c) HIGH ON A TURN FAILS 0/8: FLUX.3 returns the turned input almost unchanged (same framing, same height; photo
    222 tqb r only adds the bag). The words keep 'the same three-quarter side / rear three-quarter view as in the
    first image' - FLUX.3 seems to read that as 'keep the image'. Ideas: the front-hi words with no keep-the-view
    clause on the turned input, or Qwen for the high on a turn (round 29: Qwen moved up but lost the anime street).
- 2026-10-25 ROUND 32, HIGH ON A TURN - TWO ARMS (`angles.py <port> blender32`, sheet
  `research/sheets/mq_blender32_high_on_turn.jpg`, results `research/out/mq_blender32.json`). Same 8 turned inputs as
  round 31 (c). (a) FLUX.3 Turbo, front-hi words with NO 'keep the same ... view' clause, room high-twin ref;
  (b) Qwen-Image 2.1, round 31's words unchanged, plain high-twin ref. 8 + 8 edits (~33 s / ~56 s).
  FIRST READ (agent, sheet):
  - (a) FLUX.3 0/8 AGAIN - the input back unchanged. The clause was not the cause: FLUX.3 does not move the PITCH of
    an already-turned picture (it does on a front source, rounds 7/23).
  - (b) QWEN 8/8 a real high: looking steeply down, head and shoulders large, body foreshortened, the turn side kept
    (tq fl still faces frame-left, tqb r still from behind-right), identity + anime style held. Photo keeps the grey
    studio floor 4/4. BUT the anime STREET IS LOST 4/4 - a flat purple ground, no kerb, shop fronts or markings (same
    as round 29's Qwen high); the subject also comes out smaller (camera pulled back).
  - Read: the split extends - a pitch change on a turned stop goes to Qwen, low OR high (FLUX.3 yaw, then Qwen pitch).
    Open: Qwen's high drops the place on the 2D street - next try a reveal line naming what the high view sees around
    her (the paving, the kerb, the bases of the shop fronts, the vending machine from above).
- 2026-10-25 ROUND 33, QWEN HIGH ON A TURN + PLACE REVEAL (`angles.py <port> blender33`, sheet
  `research/sheets/mq_blender33_high_reveal.jpg`, results `research/out/mq_blender33.json`). Round 32's Qwen high on
  the 4 anime cells, the end state now names the street from above: paving with painted lines, the kerb, the shop-front
  bases with that turn's landmarks (tq fl: vending machine + blue awning; tqb r: pink awning + yellow sign board).
  4 Qwen edits, ~60 s each.
  FIRST READ (agent, sheet):
  - 4/4 THE STREET IS BACK: painted lines, kerb, pavement and shop-front bases seen from above; the vending machine
    from above on tq fl (both seeds). The high stays real (looking steeply down, head and shoulders large), the turn
    side kept, identity + anime style held.
  - Still: the subject comes out smaller than the turned input (camera pulled back), most on seed 222 - a framing line
    ("she still fills most of the frame height") is the next lever if Fabio wants it tighter.
  - Read: the reveal rule holds for Qwen too - every pitch stop names what the new view sees. With rounds 30-33 the
    two-step (FLUX.3 yaw, then Qwen pitch with a reveal line) covers low and high on every turned stop.
  - FABIO 2026-10-25 (eye test on the round 31-33 sheets): they look right.
- 2026-10-25 ROUND 34, QWEN HIGH ON A TURN + FRAMING LINE (`angles.py <port> blender34`, sheet
  `research/sheets/mq_blender34_high_framing.jpg`, results `research/out/mq_blender34.json`). Rounds 32-33's Qwen high
  (anime = round 33 reveal words, photo = round 32 words) plus one end-state line: 'The camera stays as close to her as
  in the first image: she still fills most of the frame height.' Same 8 turned inputs, plain high-twin refs, seeds
  111/222. 8 Qwen edits, ~59 s each.
  FIRST READ (agent, sheet):
  - 8/8 SHE IS BIGGER than without the line - close to the turned input's size on most cells (anime 222 tqb r was the
    smallest in round 33, now fills the frame).
  - The high holds on 7/8 (looking down, ground around her, shadow on the floor); photo 111 tq fl reads milder, nearer
    eye level. The anime street from above stays 4/4 (paving, kerb, vending machine on tq fl), turn side kept 8/8,
    identity + style held.
  - Read: keep the framing line on Qwen high steps. Fabio's eye test pending.
- 2026-10-25 ROUND 35, EVERY UNTESTED CELL (Fabio: the spec needs every angle) (`angles.py <port> blender35`, sheets
  `research/sheets/mq_blender35_profiles.jpg` + `mq_blender35_highs.jpg`, results `research/out/mq_blender35.json`).
  New doll cams from `blender/plain_build.py` (round 35 block): pr_l / pr_r (tq_fl's height + distance at +-90 deg),
  pr_l_lo / pr_r_lo, and high twins pr_l_hi / pr_r_hi / back_hi / tq_fr_hi / tq_bl_hi, rendered to out/doll + out/doll_plain.
  (a) 8 FLUX.3 profile turns (new `_profile` words + reveal / keep), (b) 8 Qwen lows on them (round 31 low words),
  (c) 20 Qwen highs on pr l / pr r / back / tq fr / tqb l (round 33 reveal + round 34 framing). 36 edits, ~33 min.
  FIRST READ (agent, sheets + head crops):
  - (a) PROFILE R 4/4 a clean right profile facing frame-right. PROFILE L WRONG SIDE 3/4: anime 111 + 222 and photo
    111 face frame-RIGHT (the pr r picture again); only photo 222 faces frame-left. FLUX.3 ignored 'facing frame-left'.
    The anime street keeps running away behind her (the 'runs across the frame' reveal did not take); photo fine.
  - (b) PROFILE + LOW 8/8 a real ground-level worm's-eye (huge sneakers, sky + power lines / black studio ceiling +
    softbox), the profile kept from the input, identity + style held.
  - (c) HIGH 20/20 moves up, identity + style held, the anime street seen from above 10/10 (paving, kerb, shop bases),
    size kept: back 4/4 strong; tq fr 4/4 (photo milder); tqb l 4/4; pr r 4/4 (photo 111 mild); pr l 4/4 high but
    Qwen re-turned anime 111 to face frame-left (follows the ref) while photo 111 kept the wrong side.
  - Read: every low/high cell works once the turn is right. Open: the FLUX.3 profile L turn - next try round 36 =
    stage 2's ORBIT 'pr L' clauses ('only her left side shows', the one-sided details) on 4 seeds.
  - CORRECTION to the round 35 read (full-size check): photo pr l faces frame-left 2/2 (not 1/2); anime pr l faces
    frame-right 2/2.
- 2026-10-25 ROUND 36, PROFILE L WITH STAGE 2's CLAUSES (`angles.py <port> blender36`, sheet
  `research/sheets/mq_blender36_profile_l.jpg`): '_PR36_L' (strict left side profile, camera exactly 90 deg to her left,
  only her left side shows, nose toward frame-left, back of her head toward frame-right), FLUX.3, seeds 111-444.
  Photo 4/4 a clean left profile facing frame-left. ANIME 0/4 - frame-right again (with round 35: 0/6).
- 2026-10-25 ROUND 37, ANIME PROFILE L - TWO ARMS (`angles.py <port> blender37`, sheet
  `research/sheets/mq_blender37_profile_l_anime.jpg`): (a) Qwen-Image 2.1 on the source, plain pr_l ref, 111-444:
  0/4 - frame-right too, and 3/4 drop the street for the ref's WHITE background; (b) FLUX.3 from its round-27 tq fl
  cell: 0/2, frame-right.
  MIRROR FINDING (agent, one-sided details: the anime woman and the photo woman both wear the WATCH on the LEFT wrist
  and the BAG on the RIGHT hip): the anime 'pr l' cells show the watch arm nearest the view while facing frame-right -
  a pose that cannot exist = a MIRROR IMAGE of a left profile. The same check flags the APPROVED anime round 27 tq fl
  (watch near, faces frame-right) and round 25 anime tqb r 222 (bag frame-left from behind-right); anime back 111/222,
  tqb l 111, tq fr 111 and pr r 111 pass; photo tq fl / tq fr / back / pr l / pr r pass, photo 24 tqb r 111 looks
  mirrored (watch frame-right). Rounds 23-35 were graded on 'faces frame-X', never on the one-sided details, so a
  mirrored cell passed. NEXT: grade every turn cell of rounds 24-37 for mirroring (watch + bag) before the spec
  locks; the left-side anime turns look systematically mirrored.
- 2026-10-25 MIRROR AUDIT, every turn cell of rounds 24-37 (198 cells, anime street 222 + photo woman), full-size
  images (sheets + crops in the session scratchpad, rebuildable from `out/mq_blender24..37.json`). One-sided details:
  WATCH on her LEFT wrist, crossbody BAG on her RIGHT hip (strap over the left shoulder). Expected per camera:
  her left side near (tq fl / pr l / tqb l) -> nose toward frame-left, watch on the near wrist; her right side near
  (tq fr / pr r / tqb r) -> nose toward frame-right, bag on the near hip; back -> watch frame-left, bag frame-right.
  P = right side, M = full mirror (watch on the near wrist AND bag on the far hip), B = bag on the wrong hip only,
  W = watch on the wrong wrist only, ? = no detail visible.

  | Stop | Cells (round: grades) | Result |
  |---|---|---|
  | back eye | r24 anime PPPP, photo PPPP; r25 street PPPP; r29/30 Qwen anime ?B ?B, photo PP PP | FLUX.3 12/12; Qwen drops the bag to frame-left 2/4 anime |
  | back lo / hi | r31 lo anime PP, photo PP; r35 hi anime PP, photo PP | 8/8 |
  | tq fl (all wordings) | r25 PPPP; r26 65/80 16x P; r27 side anime PPPP, photo PPPP; r28 8x P; r29/30 Qwen 8x P | 44/44 |
  | tq fl + lo / hi | r30 lo 4x P; r31-34 hi (FLUX.3 + Qwen, reveal, framed) 18x P | 22/22 |
  | pr l | r35 anime PP, photo PP; r36 anime PPPP, photo PPPP; r37 Qwen PPPP, from tq PP | 18/18 |
  | pr l + lo / hi | r35 lo anime PP, photo PP; hi anime PP, photo PP | 8/8 |
  | tqb l (+ lo / hi) | r31 anime PP, photo PP; lo PP PP; r35 hi PP PP | 12/12 |
  | tq fr (+ lo / hi) | r31 anime P W, photo PP; lo anime P W (inherits), photo PP; r35 hi PPPP | 10/12 (1 watch swap, inherited once) |
  | pr r (+ lo / hi) | r35 anime PP, photo PP; lo PP PP; hi PP PP | 12/12 |
  | **tqb r (FLUX.3 turn)** | **r24 anime BBBB; r24 photo M P B B; r25 street M M B B** | **1/12** |
  | tqb r (Qwen turn) | r29 anime ? B, photo B B; r30 anime ? B, photo ? P | 1/8 |
  | tqb r + lo / hi | r30 lo anime MM, photo M P; r31-34 hi anime 10x M, photo 111 M x4, 222 P x4 | = its input, every time |

  READ:
  - CORRECTION to rounds 35-37: the anime profile L is NOT mirrored. Full-size, every anime 'pr l' cell (r35 2/2, r36
    4/4, r37 6/6) faces frame-LEFT with the watch on the near wrist and sneakers pointing frame-left - a correct left
    profile. Round 35's "faces frame-right" read (and the correction under it) and round 37's MIRROR FINDING misread
    the sheet; round 27 anime tq fl is also correct (faces frame-left, watch near). Rounds 36-37 were chasing a
    problem that is not there.
  - The ONE broken stop is the REAR 3/4 RIGHT (tqb r): 2/20 across FLUX.3 and Qwen. The body turn is right (faces away
    toward frame-right), but the bag lands on her LEFT hip (frame-left) on most cells, and 3/12 FLUX.3 cells are full
    mirrors (the watch on the near right wrist too). Its mirror twin tqb l, same `_tqb` words, is 12/12 - so the
    words are symmetric and the model leans to one side.
  - A pitch step (Qwen low/high) never fixes or breaks a side: every lo/hi cell has exactly its turned input's grade.
    So the split's approved tqb r low/high cells (rounds 30-34, Fabio's eye test) carry the round 24/25 turn's error.
  - NEXT: a fix round on tqb r only - name the one-sided details in the end state (the bag at her right hip beside the
    near arm, the watch arm on the far side), 4 seeds x anime + photo, FLUX.3 Turbo.
- 2026-10-25 ROUNDS 38-39, TQB R WITH THE ONE-SIDED DETAILS NAMED (`angles.py <port> blender38` / `blender39`, sheets
  `research/sheets/mq_blender38_tqb_r_details.jpg` + `mq_blender39_tqb_r_details.jpg` (old cell row above each new
  row), results `research/out/mq_blender38.json` / `39.json`). Round 24/25 words + doll tq_br ref, FLUX.3 Turbo,
  seeds 111-444, plus one end-state sentence: (38) 'Her right side is the one nearest the view: the brown bag that hangs
  at her right hip shows at frame-right beside her near right arm, its strap running across her back from her left
  shoulder; her left arm with the wristwatch is on the far side, mostly hidden by her body.' (39) the same, the watch
  clause replaced by 'Her near right wrist is bare: the wristwatch stays on her LEFT wrist, on the far arm, hidden
  behind her body.' 8 + 8 edits, ~32 s each (~9 min GPU).
  GRADES (agent, full-size + wrist crops):
  - r38: BAG ON THE RIGHT HIP 8/8 (was 2/20), strap from the left shoulder 8/8. But the watch moves onto the near
    right wrist 5/8 (anime 222/333/444, photo 111/222; anime 111 + photo 333/444 bare). Full pass 3/8 - naming the
    watch at all pulls it into view.
  - r39: PHOTO 4/4 full pass (bag near, near wrist bare). ANIME 1/4 (111); 222/333/444 still draw the watch on the
    near wrist. Turn, street, style and identity held 8/8.
  - Read: the details line fixes the bag on both styles and the whole stop on the photo. The anime still puts the
    watch on whichever wrist shows. Flow rule: the agent names each one-sided detail and WHICH side of the frame it
    lands on for that view (proven for the bag). Open: the anime watch on tqb r - next try (not run): leave the watch
    out of the words and say only 'her near right hand is empty and bare', or accept it as a small-detail miss.
  - FABIO 2026-10-25: accept the anime watch miss on tqb r; use the round 39 words (_TQB_R39) for the 3/4 back R stop.
- 2026-10-25 ROUND 40, TQB R LOW + HIGH ON THE FIXED TURN (`angles.py <port> blender40`, sheet
  `research/sheets/mq_blender40_tqb_r_pitch.jpg` (old r24/25 turn + r30 low + r34 high row above each new row),
  results `research/out/mq_blender40.json`). Inputs = the round 39 tqb r turns, seeds 111/222, anime + photo. Qwen
  (QWEN29), plain twin refs doll_plain/tq_br_lo + tq_br_hi; low = round 31's words (`_lo31`, MQ30_PLACE), high =
  round 33's reveal words (anime) / round 31's (photo) + round 34's framing line. 8 edits, ~58 s each (~8 min GPU).
  GRADES (agent, full-size):
  - BAG ON THE RIGHT HIP 8/8 (the old r30/r34 cells: 1/8), strap from the left shoulder 8/8.
  - Near wrist bare 6/8: anime 222 lo + hi draw the watch on the near right wrist - its round 39 turn already did
    (the miss Fabio accepted). Again a pitch step keeps its input's side exactly.
  - Real low 4/4 (sky + power lines / softbox ceiling), real high 4/4 (anime street from above kept 2/2, photo 111
    high the mildest), size held (framing line), style + identity 8/8.
  - Read: the 3/4 back R low/high cells are fixed by fixing the turn - the pitch step needs no new words.
- 2026-10-25 FLOW BUILD PHASE 1 (refs + previews): the 23 doll refs the approved grid uses already existed (out/doll = FLUX.3 steps, out/doll_plain = Qwen steps); 24 Cosmo previews rendered (blender/cosmo_cams.py, EEVEE + Freestyle, GPU lease, 24/24 rendered, no errors). Agent read of research/sheets/cosmo_previews.jpg: every 3/4 view turns the right way (tq fl screen frame-left, ear frame-right; tq bl / tq br ear on the near side), lows look up, highs look down. FAIL: pr l and pr r are identical (the face is a flat decal, so side-on nothing shows the facing). Copied to assets/flows/multi-angle/ by blender/ship_assets.py (47 files, 2.5 MB; refs byte-identical to the bench's).
- 2026-10-25 ROUND 41, ZOOM AS ITS OWN WORDS-ONLY PASS (`angles.py <port> blender41`, sheet
  `research/sheets/mq_blender41_zoom_pass.jpg`, results `research/out/mq_blender41.json`). One FLUX.3 Turbo edit, ONE
  image (no ref), 9:16; words = round 21's relative crop / reveal + the view to keep + 'everything she wears stays on
  the same side'. Inputs per style: the source front, the r39 tqb r turn (FLUX.3 output), the r40 tqb r high (Qwen
  output; turn + height + zoom = the first 3-pass chain). Seeds 111/222, 24 edits, ~23 s each (~10 min GPU).
  GRADES (agent, sheet + full-size crops):
  - FRONT: in 4/4 clearly closer (crops mid-thigh, not the waist the words name), out 4/4 (photo: backdrop edges +
    light stands; anime: more street, shop fronts). Bag on her right hip 4/4, watch on her left wrist 4/4, likeness kept.
  - TQB R HIGH (3-pass): in 4/4 clearly closer, out 4/4 small with the ground from above. Bag right 4/4; near wrist bare
    3/4 (anime 222 = the r39 watch miss Fabio accepted, inherited). High kept 3/4 (photo 111 zoom-in reads closer to
    eye level). Likeness: no visible loss on the 3-pass chain (faces mostly hidden at this view - a front-facing chain is
    still untested).
  - TQB R EYE-LEVEL TURN: in 0/4, out 0/4 - FLUX.3 returns the input unchanged (mean pixel diff 3-6/255 = noise).
  - Read: zoom in words works as its own pass on the source and on a Qwen result, but FLUX.3 will not re-edit a FLUX.3
    turn - the same freeze as rounds 31-32 (no height change on a turned picture). Next: the zoom pass on Qwen for a
    FLUX.3-turned input (r39 tqb r + r27 tq fl, 8-16 edits), as the height split already does.
- 2026-10-25 ROUND 42, THE ZOOM PASS ON QWEN FOR FLUX.3 TURNS (`angles.py <port> blender42`, sheet
  `research/sheets/mq_blender42_zoom_qwen.jpg` (r41's frozen FLUX.3 cells beside), results
  `research/out/mq_blender42.json`). Round 41's words (tq fl view/crop words added), QWEN29, one image, no ratio/tier.
  Inputs r39 tqb r + r27 tq fl, anime + photo, seeds 111/222, in + out = 16 edits, ~43 s each (~12 min GPU).
  GRADES (agent, sheet + full-size crops):
  - Qwen ZOOMS where FLUX.3 froze: in 8/8 clearly closer, out 8/8 far (photo: whole studio rig, anime: long street).
  - View kept 8/8 in, 8/8 out (tqb r stays rear 3/4, tq fl stays near side-on; photo 222 tq fl in faces a little more
    toward the camera, as its input already did).
  - Sides: tqb r bag on the right hip 4/4; tq fl watch on the near left wrist 4/4 (correct for that side).
  - MISS: photo tqb r zoom-in crops her HEAD off 2/2 (frame = shoulders to hips); anime tqb r in keeps the head 2/2.
    Fix = round 31's 'with her whole head still in frame' on zoom-ins.
  - Likeness: photo tq fl in faces read as the same woman; anime held.
  - Read: the zoom pass routes like height - FLUX.3 on the source, Qwen on any picture FLUX.3 already turned (and on
    Qwen results). FABIO 2026-10-25: zoom must span both ways - all the way in on a full body = the face, on a face =
    an eye; all the way out = the far camera these rounds already get. So zoom is a ladder of named framings, not one
    'closer' stop (next round).
- 2026-10-25 ROUND 43, THE DEEP ZOOM RUNGS IN ONE PASS (`angles.py <port> blender43`, sheet
  `research/sheets/mq_blender43_zoom_rungs.jpg`, results `research/out/mq_blender43.json`). Rungs head-and-shoulders
  (hs) / face / eye named as the TARGET framing (+ the view to keep, a shorter keep line without hands/bag/shoes), one
  edit each from the full body: front source on FLUX.3 (9:16), r27 tq fl turn on Qwen; + the face source -> eye on
  FLUX.3 (4:5). Seeds 111/222, 26 edits (~33 min wall incl. Qwen ~40 s, FLUX.3 ~20 s; GPU ~13 min).
  GRADES (agent, sheet):
  - FRONT (FLUX.3): hs 4/4 a clean head-and-shoulders. face 0/4 a face-filling close-up - it lands one notch tighter
    than hs at most (anime crops the crown, photo ~= hs). eye 4/4 a real extreme close-up of the right eye (frame-left,
    the named one), half the face around it; style held 4/4.
  - TQ FL (Qwen): hs 4/4, near-profile view kept. face 1/4 tighter (anime 111); photo 222 comes out WIDER (waist-up)
    and anime 222 ~= hs. eye 2/4 (anime 111 profile eye, photo 111 a quarter-face close-up); anime 222 returns a
    shoulder-and-hair view, photo 222 a half face with hair.
  - FACE SOURCE -> EYE (FLUX.3): 2/2 excellent - the green eye, lashes, brow; the cheek moles on the right side.
  - Likeness: photo hs/face rungs read as the same woman 8/8; an eye from a full body is invented detail (the source
    face is ~100 px) - only the face source's eye carries her real eye.
  - Read: from a full body, ONE pass reliably reaches hs and (on FLUX.3) the eye; the 'face' words do not separate
    from hs; Qwen is unreliable past hs on a turned view. Ideas: stronger face words ('only her face, edge to edge,
    the top of her head and her chin cut by the frame'), or deep rungs CHAINED (hs first, then face/eye from the hs,
    the way the face source -> eye works 2/2), or crop + refine. Fabio's call.
- 2026-10-25 ROUND 44, THE FACE RUNG IN FABIO'S WORDS (`angles.py <port> blender44`, sheet
  `research/sheets/mq_blender44_face_frame.jpg`, results `research/out/mq_blender44.json`). MQ44_FACE ('Frame her
  face: her face fills the whole frame ... no neck, shoulders or clothes show') + MQ44_KEEP (no clothes, no place).
  Arms: 'one' = full body -> face (front source on FLUX.3, r27 tq fl turn on Qwen); 'chain' = r43 hs -> face (Qwen).
  Anime + photo, seeds 111/222, 16 edits, 0 errors (FLUX.3 ~21 s, Qwen ~43 s; ~9 min GPU).
  GRADES (agent, sheet; bar = tighter than r43's face cell, likeness + style kept):
  - The strict bar (face edge to edge, no neck/clothes) is met 0/16: the turtleneck collar shows in every cell.
    'no neck, shoulders or clothes' is not obeyed; the gain is how much of the frame the face takes.
  - FRONT ONE (FLUX.3): 2/4. Anime 111/222 tighter (crown cut, collar band only). Photo 111 ~= r43 (no gain).
    Photo 222 BROKEN: a big-head caricature on the full body (bobblehead) - FLUX.3 scaled the head, not the camera.
  - FRONT CHAIN (Qwen on the FLUX.3 hs): 4/4 - the best arm. Face takes ~2/3 of the frame, collar at the bottom
    edge, likeness + style held 4/4 (anime stays flat 2D, photo stays photographic).
  - TQ FL ONE (Qwen on the r27 turn): 4/4 tighter than r43 (face + collar), near-profile kept 3/4 (photo 222 turns
    toward the camera); anime 222 swaps the street for blue sky.
  - TQ FL CHAIN (Qwen on the Qwen hs): 0/4 - no tighter than the hs AND the style breaks 4/4: a gritty, over-
    sharpened HDR/etching texture on skin, hair and background (anime too). Qwen on a Qwen result degrades.
  - Read: chaining works when the hs came from FLUX.3 (one Qwen pass on a FLUX.3 picture); a second Qwen pass on a
    Qwen picture is a new failure mode - the routing rule becomes 'never two Qwen passes in a row', mirroring
    'never FLUX.3 on a FLUX.3 result'. Fabio's wording moved the rung (r43 face 1/8 tighter -> 10/16 tighter here),
    but a face-only frame (no collar) still does not land; the face rung = 'face and the top of the collar'.
- 2026-10-25 ROUND 45, THE EYE RUNG IN THE SAME WORDS (`angles.py <port> blender45`, sheet
  `research/sheets/mq_blender45_eye_frame.jpg`, results `research/out/mq_blender45.json`). MQ45_EYE ('Frame her right
  eye, the one on frame-left: the eye fills the whole frame ... no nose, mouth or hair show') + MQ44_KEEP, models
  alternating per round 44's rule. Arms: 'hs' = Qwen on r43 front hs (FLUX.3); 'face' = FLUX.3 on r44 front chained
  face (Qwen); 'tq face' = FLUX.3 on r44 tq fl one-pass face (Qwen), her near left eye. Anime + photo, 111/222, 12
  edits, 0 errors (Qwen ~44 s, FLUX.3 ~23 s; ~6 min GPU). Reference column = r43's one-pass FLUX.3 front eye.
  GRADES (agent, sheet; bar = the eye fills the frame, likeness + style kept):
  - The strict bar (eye edge to edge, no nose/mouth) is met 0/12. FLUX.3's ceiling is a HALF-FACE eye close-up (eye,
    brow, cheek, nose edge, often the lips) - the same framing r43's one pass from the FULL BODY already gives.
  - EYE FROM HS (Qwen): 0/4. Anime 111/222 + photo 111 return the hs unchanged (Qwen freezes on the eye words, as
    FLUX.3 does on its own turns); photo 222 shifts the frame sideways to a cheek + hair crop with no eye.
  - EYE FROM FACE (FLUX.3): 3/4 at the half-face ceiling (anime 111 the best cell - eye, lashes, earring; frame-left
    side right), anime 222 only a notch tighter. Photo 222 BROKEN: one eye on a face with no nose or mouth, the
    collar below - anatomy fails when the eye words fight a face that fills the frame.
  - EYE FROM TQ FACE (FLUX.3): 0/4 an eye frame, 3/4 a notch tighter (photo: brow-to-lips half profile, the near
    eye kept); anime 222 ~= the input. Style held 4/4, view held 4/4.
  - Read: chaining buys nothing for the eye - r43's ONE FLUX.3 pass from the full body reaches the same half-face eye
    (4/4) without the risk of the broken photo 222. 'No nose, mouth' is ignored like 'no neck' was in round 44:
    both models obey the TARGET subject, not what the frame should cut. The deepest rung the words reach is a
    half-face eye close-up; an eye edge to edge needs crop + refine (crop the eye box from the face/hs cell, then a
    detail/upscale pass) if Fabio wants it.
  FABIO 2026-10-25: ACCEPTED - the half-face eye close-up is the deepest rung, one FLUX.3 pass from the source.
- 2026-10-25 ROUND 46, THE OUTWARD RUNGS (`angles.py <port> blender46`, sheet
  `research/sheets/mq_blender46_zoom_out_rungs.jpg`, results `research/out/mq_blender46.json`). Zoom OUT from a
  close-up, rungs waist-up / whole body / far in the 'Frame her ...' style (MQ46_RUNGS), + 'what the first image does
  not show of her outfit continues it plainly, in the same colours and style' on full/far, MQ46_KEEP. Arms: the
  untouched studio PORTRAIT (face source, head-and-shoulders - the common user input) on FLUX.3 4:5; r43 front hs (a
  FLUX.3 result) on Qwen, anime + photo. Seeds 111/222, 18 edits, 0 errors (FLUX.3 ~19 s, Qwen ~44 s; ~10 min GPU).
  GRADES (agent, sheet; bar = the named framing, view/likeness/style kept, plausible invented outfit):
  - Ladder order held 6/6 rows: waist < whole body < far, front eye-level view kept 18/18, style kept 18/18 (anime
    stays flat 2D, photo stays photographic), earrings + necklace (portrait) + bag strap (hs inputs) kept.
  - WAIST: 6/6 a wider frame; FLUX.3 portrait lands mid-torso (a notch short of the waist), Qwen hs only one small
    notch out on anime 111 (cropped at the hips).
  - WHOLE BODY: 6/6 head to shoes. The invented outfit is plausible and in the sweater's colours: portrait = a rust
    knit dress (boots / heels), anime = a rust jumpsuit or wide trousers, photo hs = brown trousers + shoes. The real
    source outfit (purple trousers + white sneakers anime, jeans + white sneakers photo) is of course not recovered.
  - FAR: 6/6 more of the place - studio with softboxes and stands (photo), the long street (anime) - but she is
    'small in the middle' only on photo hs (~55% of the height); portrait and anime stay at ~70-80% (~= whole body +
    more place). Weakest rung.
  - Outfit consistency across rungs: portrait 222 = a dress at 'full' but trousers at 'far'. Each rung invents anew.
  - Likeness: portrait and photo hs read as the same woman at waist; at full/far the face is small and held.
  - Read: zoom-out works both from an untouched portrait (FLUX.3) and from an edited close-up (Qwen) - 18/18 in the
    right direction. Two open points for the Flow: (1) far needs stronger distance words (the figure a third of the
    frame height, the whole place around her) - or it is 'whole body + place' and not a separate stop; (2) an
    invented outfit drifts between rungs/seeds - the Flow should chain the outward rungs (far FROM the full-body
    result) or have the agent name the outfit once and reuse the words.
  FABIO 2026-10-25: zoom-out from a close-up gets two OPTIONAL Flow inputs - a prompt box for the unseen outfit/place
  and a second reference image (full body / character sheet).
- 2026-10-25 ROUND 47, THE OUTFIT INPUTS (`angles.py <port> blender47`, sheet
  `research/sheets/mq_blender47_outfit_inputs.jpg`, results `research/out/mq_blender47.json`). r43 front hs (the real
  outfit is known: anime purple trousers + white sneakers, photo dark jeans + white sneakers + bag on her right hip) ->
  whole body / far on Qwen, round 46's words with three arms: 'words' (MQ47_OUTFIT, the prompt-box text), 'ref' (the
  full-body source as inputImage2 + MQ47_REF 'the second image is only for her clothes'), 'both' (whole body only).
  Anime + photo, seeds 111/222, 20 edits, 0 errors (one image ~40 s, two images ~60 s; ~16 min GPU).
  GRADES (agent, sheet + mean pixel diff to the ref):
  - WORDS: outfit right 8/8 - photo dark jeans + white sneakers 4/4, anime purple trousers + white sneakers 4/4 (but a
    paler lavender than the real deep purple: the words carry the item, not the exact shade). Framing, place, style
    and the bag strap kept; far still only ~= whole body + more place, as round 46.
  - REF, FAR: outfit EXACT 4/4 (deep purple / dark jeans, white sneakers, the bag on the hip) at a new framing - the
    figure is smaller than every other far cell (the best 'far' so far). This is the real proof the ref arm works.
  - REF + BOTH, WHOLE BODY: outfit exact 8/8, but the result is close to a COPY of the ref (photo mean diff 6-13/255
    = near-identical; anime 37-43 vs 55-65 for words, visually the ref redrawn - the ref's purple road, the ref's
    pose). The bench's ref IS the target framing, so copying it looks right here - but in the Flow the ref may show a
    different place, light or pose, and those would leak. Not yet proven: the ref arm from a ref in ANOTHER place/pose.
  - Read: both inputs work. Words = the right items, approximate colours, zero leak. Ref = exact clothes; at a framing
    unlike the ref (far) it transfers only the clothes, at the ref's own framing (whole body) it returns the ref.
    Next test (if Fabio wants it): a ref that differs - a character sheet / full body on a plain backdrop, another
    pose - zoomed out to whole body, to see if place/pose leak.
- 2026-10-25 ROUND 48, A REF THAT DIFFERS (`angles.py <port> blender48refs` then `blender48`, sheets
  `research/sheets/mq_blender48_refs.jpg` + `mq_blender48_ref_leak.jpg`, results `research/out/mq_blender48.json`).
  Refs made by one FLUX.3 edit of each full-body source (MQ48_REFS), eye-checked good 4/4: 'A' = same outfit on a
  plain white backdrop, hands on hips, turned a little; 'B' = a front / side / back turnaround sheet on white (16:9).
  Then r43 front hs -> whole body (A, B, A + words) and far (A, B) on Qwen, round 47's words. Anime + photo, seeds
  111/222, 4 + 20 edits, 0 errors (~22 min GPU).
  GRADES (agent, sheet + backdrop brightness of the top corners, 0-255):
  - OUTFIT: exact 20/20 from both refs (deep purple / dark jeans, white sneakers, the bag on the hip).
  - LAYOUT leak from the sheet: 0/8 - always ONE figure, front view, at the named framing.
  - POSE leak from ref A: 12/12 - every A cell (whole body, A + words, far) puts her hands on her hips. Ref B's
    neutral front figure gives arms down 8/8. The prompt-box words do not stop it.
  - PLACE leak from ref A: photo whole body 4/4 - the grey backdrop turns near-white (corners 225-231 vs 137-151 for
    the hs input, r47 words, ref B). Anime street held 10/10; photo far held 4/4 (the far words name the studio rig).
    Ref B: no place leak 8/8.
  - Likeness + style held; anime stays flat 2D 10/10.
  - Read: a CHARACTER SHEET is the clean second reference - exact outfit, no pose, place or layout leak (8/8). A
    single full-body shot carries its POSE every time and, at the whole-body rung, its BACKDROP. For the Flow: the
    second-ref slot asks for a character sheet / turnaround first; a single full-body picture works for the clothes
    but the result copies its pose (and on a plain photo backdrop, its backdrop). Prompt-box words alone (r47) never
    leak but give approximate colours.
- 2026-10-25 ROUND 49, FAR RUNG REWORDED + REAR ZOOM-IN HEAD (`angles.py <port> blender49`, sheets
  `research/sheets/mq_blender49_far_rung.jpg` + `mq_blender49_rear_zoom_in.jpg`, results `research/out/mq_blender49.json`).
  (a) MQ49_FAR (names the figure's size - about a quarter of the frame's height - and 'most of the frame is the place')
  in two arms: 'chain' = far from r46's whole-body result, models alternating (portrait full FLUX.3 -> Qwen; hs full
  Qwen -> FLUX.3 9:16); 'one' = same words in one pass from the close-up (portrait FLUX.3, r43 hs Qwen). (b) Qwen
  zoom-in on r39 tqb r: the waist rung + 'with her whole head still in frame, from the top of her hair down', and a
  rear head-and-shoulders rung. Seeds 111/222, 20 edits, 0 errors (~15 min GPU, Fabio's yes).
  GRADES (agent, sheets):
  - FAR CHAIN: small figure 6/6 (whole studio rig / long street), view + style kept, and the outfit is exactly the
    whole-body input's 6/6 - chaining from the whole body ends the r46 outfit drift.
  - FAR ONE, Qwen from hs: small 4/4 (the new words work on Qwen) but the invented outfit drifts again (anime: a long
    dress instead of the trousers 2/2). FAR ONE, FLUX.3 from the portrait: 0/2 smaller - the same frame as r46's far.
  - REAR WAIST + head words: photo still cuts the head off at the top edge 2/2 (near-copy of r42 - Qwen ignores the
    head line on this rung); anime keeps the head 2/2 as in r42.
  - REAR HS rung: whole head in frame 4/4 (photo 2/2 clean; anime 111 grazes the hair top), rear view + side kept,
    bag strap on the right shoulder 4/4.
  - Read: the far rung = ONE MORE PASS from the whole-body rung (outward zoom walks the ladder: ... -> whole body ->
    far), models alternating. Rear zoom-in: the hs rung is clean; the waist rung on a rear photo still crops the
    head - an open cell (a 'Frame her from the waist up' rewording, r46 style, is unbenched on the rear).
- 2026-10-25 FLOW BUILD PHASE 2 (prompt builder): `js/data/flowPrompts/multiAngle.js` + `tests/multi-angle-prompts.test.cjs`.
  57 of the 61 accepted bench cells (`research/accepted_prompts.md`) rebuilt word for word from the bench woman's
  facts; the 4 not rebuilt are named in the test (tq fl lo predates r31's head line; rear waist is unbenched). A
  one-word mutation changes the output (checked). Full suite: 3640 tests, 0 fail; eslint clean on both files.
- 2026-10-25 FLOW BUILD PHASE 3 (session "Flux 3 on flows 26"): route test `tests/multi-angle-ref-route.test.cjs` 3/3
  (size = source; edge columns repeat the square's edge - doll edges are non-black and vary by row, so a colour pad
  fails it; file reused; bad input coded, nothing written). eslint clean on the 7 files; full suite 3648 pass, 0 fail.
  LIVE DESCRIBER (DeepInfra gemma-4-26B-A4B-it, greedy, 2 calls, /llm/describe in an isolated app): both answers TRUE
  to the pictures (bag right hip, watch left wrist, earrings, sneakers, plain vs scene, anime style). Weak spots:
  (1) anime FROM_ABOVE = none on a scene (the ask's 'plain: none' read as 'none'; parser falls back to GROUND);
  (2) anime RIGHT = 'the shop fronts and the pink awning' - repeats SIDES (prompt reads 'the shop fronts on her left,
  with the shop fronts and ...') and misses the yellow sign board; (3) photo FAR = 'with the full height of the
  studio and more of the floor' - the anime example's shape, thinner than the benched far words. Copy risk is not
  testable on the bench pictures (the examples ARE their words) - needs a third, unrelated picture.
- 2026-10-25 ASK REWORDED (Fabio's yes for 6 more calls; 6 spent, 8 in all): two rounds on the two bench pictures +
  an unrelated one (`Cowgirl on a Bull/Media/edit_001.png`, comic rodeo). Ask changes: "the examples only show the
  form: name what is in THIS picture"; FROM_ABOVE "for a scene, always answer"; LEFT/RIGHT "single objects, never
  the SIDES again, never the same as each other"; FAR always starts "with", with a street AND a studio example.
  Round 2 result: anime FROM_ABOVE now = the bench words; RIGHT = 'the shop entrance and the pink awning' (no SIDES
  repeat; the yellow sign board still missed); FAR on all three a full clause ('...seen from head to shoes, with the
  full height of the wooden fences and much more of the ranch landscape in front of her'). Rodeo: NO example copied
  (no bag, watch or shop fronts; boots, comic, ranch, orange/yellow sky - true). One rule ignored both rounds: rodeo
  LEFT = RIGHT = 'the wooden fence'. Fixed in `parseMultiAngleFacts`: the same thing at both edges reads as none, so
  the place takes the plain branch (no turn words that show and hide the same fence); test added. Drift from the
  bench words, unbenched: photo FAR now 'with the whole studio around her - ...' (bench: 'and the whole studio now
  shows around her - ...'); photo ABOVE answered 'the grey studio ceiling' in round 2. Multi-angle tests 16/16, full
  suite 3649 pass, 0 fail, eslint clean.
- 2026-10-25 FLOW BUILD PHASE 4 (session "Flux 3 on flows 27"): FlowDef `multi-angle` (devOnly, driver 'multiAngle', FLUX.3 slot + OPTIONAL Qwen slot, agentOpens 'angle', slots inputImage + inputImage2, run-slide field outfitWords), slots-only op `flowMultiAngle` in 3 registries (no graph, like flowStoryboard), driver registered in FLOW_DRIVERS (storyboardDispatch.js, LTX 2.5 model 18 agreed). Gizmo = new step kind `angle` (`js/components/Organisms/MpiStepAngle/`): Cosmo preview over Turn (9 stops, full turn, front in the middle, back at both ends) / Height / Zoom sliders; offers only benched stops (`multiAngleChoices` in multiAngle.js; without Qwen only FLUX.3-alone stops); a disallowed stop keeps the thumb where it was; a slider with nothing to offer greys + inert; a note says why. Driver reads `stepValues.inputImage`; an untouched gizmo refuses Generate ('Pick a new view first'). Checks: tests/multi-angle-gizmo.test.cjs 8/8 (incl. every offered choice is a pick the planner runs, 24 previews on disk), full suite 3660 pass / 0 fail, eslint clean. LIVE in an isolated app: tile in the Library, gizmo renders, mouse drag works, preview swaps, greying + notes right, the pick lands in s_flowInputs stepValues and restores on reopen. Fixed on the way: note text overlapping (frame sets line-height 0), hint no longer repeats the note, all 24 previews preloaded (a fast drag showed the last stop's Cosmo). FOUND: MPI-1287 (frame restore put slot 1's picture into an empty slot 2 - also Character Sheet Editor); LTX 2.5 model 18 fixed it in its files (restoreSlotItems), confirmed live. NOT run: a GPU generation through the Flow (phase 5 live run).
- 2026-10-25 GIZMO MOVED (Fabio: no Angle step, small on Generate): field type `angle` (js/utils/declaredFields.js branch, after LTX 2.5 model 18's e7593e3e6) mounting Compound `MpiAngleGizmo` (132-px Cosmo + Turn/Height/Zoom). Flow is 2 steps now (Inputs, Generate); agentOpens 'run'; driver reads inputs.angle. Full suite 3661 pass / 0 fail, eslint clean. LIVE in an isolated app: picker on the Generate slide above the outfit box, mouse drag on Turn moves Cosmo to 3/4 back right, note shows, value persisted as s_flowInputs['multi-angle'].angle. MPI-1287 closed (fixed in e7593e3e6, checked live).
- 2026-10-25 ROUND 50, THE ZOOM LADDER ON THE OTHER SIX TURNS (`angles.py <port> blender50`, sheets
  `research/sheets/r50a_zoom_turned_views.jpg` (tq fl / tq fr / pr l) + `r50b_zoom_turned_views.jpg` (pr r / tqb l /
  back), results `research/out/mq_blender50.json`). Qwen zoom pass on each accepted FLUX.3 turn cell (r27 tq fl side,
  r31 tq fr + tqb l, r35 pr l + pr r, r24 back eye): IN = the r43 hs rung (side views) or r49's rear hs form (tqb l,
  back), OUT = r49's far rung, one pass from the whole body; the view kept named per turn (MQ50_KEPT). Anime + photo,
  seeds 111/222, 48 edits, 0 errors, ~41 s each (~33 min GPU, Fabio's yes).
  GRADES (agent, sheets + full-size crops; bar = the named framing, view/side/style kept):
  - FAR: 24/24 - a small figure with the long street / the whole studio rig (softboxes, backdrop edges), the turn
    kept (side-on, profile, rear 3/4, back), style kept (anime flat 2D, photo photographic).
  - HS, SIDE VIEWS (tq fl, tq fr, pr l, pr r): 16/16 a head-and-shoulders close-up, whole head in frame, style kept.
    View kept 15/16: photo 111 tq fr turns her face a notch toward the camera (r42 photo 222 tq fl did the same);
    photo 222 tq fl is near-frontal because its INPUT already is. Profiles stay clean profiles 8/8. Earring side right.
  - HS, BACK: 3/4 - photo 2/2 and anime 222 clean back-of-head + shoulders; anime 111 a notch wide (to the waist),
    head kept.
  - HS, TQB L: 1/4 - anime 2/2 land at WAIST-UP (back, arms, top of the trousers) not hs; photo 111 is hs but swings
    to a straight back view (the cheek edge gone); photo 222 clean. Head kept 4/4 (unlike r42/r49's rear waist).
  - Read: the two-step zoom (FLUX.3 turn, Qwen zoom) holds on every turn for far, and for hs on the side views and the
    back. tqb l hs is the open cell (lands a notch wide on anime) - not offered. Widened: hs + far on tq fl, tq fr,
    pr l, pr r, back; far on tqb l (tqb r keeps hs only: its far is unbenched).
- 2026-10-25 ROUND 51, ZOOM ON THE LOW AND HIGH VIEWS (`angles.py <port> blender51`, sheets
  r51{a,b}_zoom_{lo,hi}.jpg): hs + far on every lo and hi cell the Flow runs. Zoom pass FLUX.3 Turbo 9:16 on the Qwen
  lo/hi cells, Qwen on the FLUX.3 front hi. Anime + photo, seeds 111/222, 130 edits, 0 errors (paused at 42 for
  Fabio's GPU test, resumed in session "Multi-Angle 31", ~20-80 s each).
  GRADES (agent, sheets + crops; bar = the named framing, height/view/style kept):
  - FAR, LOW: 32/32 - a small figure, camera still low (sky and building tops, the studio ceiling rig), turn kept.
  - FAR, HIGH: 32/32 - a small figure from above on the street / studio floor, turn kept, front hi included.
  - HS, HIGH, the seven turns (tq fl..back): 28/28 head-and-shoulders, looking down, turn and side kept.
  - HS, HIGH, FRONT: 0/4 - the Qwen zoom on the FLUX.3 front hi gives a bigger foreshortened figure, feet still in
    frame (anime 2/2 whole body, photo to the waist / knees). Not offered.
  - HS, LOW, SIDE VIEWS + FRONT (front, tq fl, pr l, pr r): lands chest-to-WAIST-up, not hs, on most cells (the low
    camera keeps the torso big); front anime 2/2 clean hs. tq fr 1/4 (anime crops to the hips with the bag).
  - HS, LOW, BACK VIEWS (tqb l, tqb r, back): 0/12 - every one frames the seat and hips, head small at the top. Fail.
  - Read: far opens on every lo and hi cell; hs opens on hi for the seven turned views. lo hs (and front hi hs) need
    a stronger wording round before anything is offered - ask Fabio before the GPU.
- 2026-10-26 VIEW READ (session "Multi-Angle 33"; Fabio reconsidering auto-detect instead of bypass buttons): the
  describe ask + FACING (picture directions: front, front-left, left, back-left, back, mirrored) + CAMERA (level/low/
  high) on DeepInfra gemma-4-26B-A4B-it, greedy, on 115 bench pictures of known view (accepted turn x height cells,
  r50/r51 turned zooms, both sources; research/viewread.py, out/viewread.json). $0.019 spent (Fabio's yes for ~3c).
  Exact turn 68/115, height 84/115, both 50/115. Coarse group front / turned-front / rear 115/115. Left vs right 63/80,
  biased to 'left'. 3/4 front reads as profile almost always. Low 31/32; high 23/45 (photos read level); level 30/38
  (anime reads low). Local Qwen3-VL 4B (the default describer) NOT tested - needs Fabio's GPU.
  ROUND 2 (Fabio's yes for ~2c; $0.021 spent, $0.040 in all; research/viewread2.py, out/viewread2.json): ask what
  SHOWS - EYES (two / two-far-small / one / none), NOSE and CHEST (which IMAGE side they point to), TOP_OF_HEAD and
  UNDER_CHIN yes/no - view worked out in code. Side 71/71 (NOSE in image terms fixes left/right). 3/4 vs profile still
  fails ('one' eye on most 3/4s); rear 3/4 often 'none/hidden/away' = back; height worse (hi 0/45 on the yes/no cues).
  BEST MIX (round 1 FACING group + CAMERA, round 2 NOSE/CHEST side): front / turned-left / turned-right / rear 115/115;
  height 84/115 (lo 31/32, level 30/38, hi 23/45). Not readable: 3/4 vs profile, rear 3/4 vs back, a high camera.
