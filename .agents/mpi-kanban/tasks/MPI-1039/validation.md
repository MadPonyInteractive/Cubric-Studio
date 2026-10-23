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
