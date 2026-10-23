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
