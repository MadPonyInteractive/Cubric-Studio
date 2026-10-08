# MPI-1042 validation

Bench verdicts land here per risk (`plan.md` Phase 2), with the seed, inputs and Fabio's call.

## 2026-10-08 - starter bench graph (offline checks only, no GPU run)

- `node scripts/workflow-to-api.mjs <graph>` against the live bench `/object_info` (:8188):
  exit 0, 44 executable nodes, every link resolved to the intended input.
- Branch simulation over the API graph (MpiIfElse laziness honoured): with Picture 2 not
  loaded, nodes 6-16 + 19 + 32 (SAM3, head fill, ref 2, with-body prompt) never execute; every
  node runs in one mode or the other.
- Not yet run on the GPU: that is Fabio's first bench run.

## 2026-10-08 - first two bench runs (Fabio, seed 976866873943, no body, empty user text, 1280x800)

- **Front face (979x1024):** identity held, piercings + neck tattoo kept. The portrait is a near
  pixel copy of the picture (NCC 0.975, face crop vs portrait panel, `stretch.py` in the session
  scratchpad, bench python cv2) at **sx 0.71 / sy 0.77**: ~7% taller and narrower, plus soft
  detail. Cause: Klein fitted the picture's HEIGHT to the 800 px panel (1024 x 0.78) while the
  0.96-aspect picture is wider than the 0.80-aspect panel. A real stretch, not only detail loss.
- **3/4 face, smiling, torso shot (574x1024):** identity lost and the face turned to camera.
  Cause: our own `Sheet_Layout` asked for "close to frontal", "both eyes looking into the
  camera", "neutral expression, mouth closed". Re-posing makes Klein redraw the face instead of
  copying it, and copying is where its identity comes from.
- **Run 3 (Fabio): 1792x1120, Picture 1 scaled to 2 MP, new portrait sentence, the uncropped
  3/4 torso shot.** Ran on his card (no OOM). Quality clearly better (Fabio). The portrait still
  came out nearer frontal with the smile gone: the face in a torso shot is small, so there is
  little to copy. Fabio's direction: a box on the face picture like Head Swap, so more face
  reaches Klein. Close-up test next.
- **Run 4 (Fabio, `bb33e9b2`): 1792x1120, the UNCROPPED front picture (979x1024).** Detail much
  better; still stretched (Fabio: face, neck, hat longer). Measured sx 0.88 / sy 0.96, ratio
  0.92 (NCC 0.959): the same distortion as run 1 (0.93), so resolution does not touch it. The
  4:5 crop is the untested half.
- Next tests: 4:5 crops of both pictures (`input/mpi1042_*_4x5.png`), 1792x1120 (portrait panel
  896x1120 = 4:5, ~1:1 with the picture), and a portrait sentence that keeps image 1's turn,
  tilt and expression.

## 2026-10-08 - autonomous bench, batch 1 (agent, Fabio at lunch; :8188 under gpu_lease)

Bench graph as saved (1792x1120, Picture 1 at 2 MP, run-3 `Sheet_Layout`, no body, empty user
text), seeds 976866873943 / 42 / 1234. Measured with a coarse-to-fine `stretch.py` (face crop
of the source vs the output's right half, NCC).

- **Issue B, front 4:5 crop (819x1023): NOT fixed.** sx/sy **0.930 / 0.942 / 0.964**, NCC
  0.986 / 0.979 / 0.988 (a near-pixel copy, squeezed). The cause is not the picture's aspect:
  Klein gives the two body views ~900-1030 px and the portrait whatever is left (~762 / ~792 /
  896 px wide), then fits the WHOLE picture width into that strip. The narrower the strip, the
  worse the squeeze; even at the full 896 px it is 0.96.
- **Issue A, 3/4 4:5 crop (574x717): NOT fixed.** s976 and s1234 came out frontal with the smile
  gone (NCC 0.645 / 0.651: a redraw, not a copy); s42 kept the smile and a mild turn (NCC 0.663).
  Reading: the desert, warm-light picture has to be re-lit onto grey, so Klein redraws instead
  of copying, and a redraw falls back to a frontal portrait. The front picture already sits on
  grey, so it is copied (NCC 0.98).

## 2026-10-08 - batches 2-4 (same seeds, same bench)

- **P - the portrait on its OWN 896x1120 sampling** (portrait-only prompt, "keeps the head
  exactly as it is in image 1 ... the same framing", grey, soft light):
  - front crop: sx/sy **0.981 / 0.991 / 0.991**, NCC 0.99 - **Issue B fixed.**
  - 3/4 crop: **turn held 3 of 3**, same side (eyebrow piercing + earring on the picture's
    side), smile kept, re-lit onto grey - **Issue A fixed.** Its stretch reads 0.94-0.97 but at
    NCC 0.24-0.37 (re-lit, so not a pixel copy): an eye check, not a measurement.
- **A1 - the turn named in words** ("turned three-quarters toward the left side of the image"),
  one-shot sheet: turn back 3 of 3, but the face is redrawn every time (smile gone on 2, likeness
  drifts), the strip stays narrow so it stays squeezed, and the app does not know the side.
- **A2 - "the right half is image 1 itself, re-lit on the grey background"** + "soft" instead of
  "frontal" illumination: smile kept and a mild turn 3 of 3, but s42 grew a ghost third figure,
  and the strip stays narrow (squeezed).
- **Stitching P with a separate 896x1120 body-views half:** sheets look right, but the grey
  does not always match across the join: front crop diff <= 6/255 (invisible), 3/4 crop up to
  **21/255 (a visible step, s1234)** - the re-lit grey is picked per sampling.
- **Two passes, pass 2 as an EDIT** (canvas [black | portrait] as ref 1 and as the latent, the
  Outpaint Flow's recipe, "keep the portrait exactly as it is"): FAILED - Klein redrew the whole
  canvas as three full-body views, the portrait gone. A prompt cannot lock a region; next is
  pass 2 as an INPAINT (`SetLatentNoiseMask` over the left half + 32 px).

## 2026-10-08 - batches 5-7, two passes on one 1792x1120 canvas (inpaint)

- **T3 - portrait first, then inpaint the left half (+32 px) with an "outpaint" prompt, refs =
  canvas + picture 1:** portrait locked (sx/sy 0.981 / 0.991 / 0.991), turn kept, no seam - but
  only ONE body view, 6 of 6. Out.
- **T4 - same, but pass 2 = the one-shot sheet prompt, ref = picture 1 only:** turn kept and no
  seam 6 of 6, two body views - but Klein still lays them out ~1030 px wide, so the locked
  portrait CLIPS the back view in 3 of 6 (front s976, front s42, 3/4 s42). Out unless the
  layout can be held to 896 px.
- **T5 - reversed: the body views first on their own 896x1120, then inpaint the portrait into
  the right half with the sheet prompt:** the squeeze comes back (0.939 / 0.942 / 0.973) and
  ghost / side figures appear at the join. Out after 3 runs. So the squeeze belongs to drawing
  the portrait INSIDE the sheet prompt, not to the panel width: only a portrait sampled on its
  own 4:5 canvas comes out unsqueezed.

## 2026-10-08 - batch 8, T6: two samplings, stitched - the candidate fix for A and B

Pass 1 = the portrait alone, 896x1120 (P above). Pass 2 = the body-views half alone, 896x1120,
refs = picture 1 + the FINISHED PORTRAIT, prompt ending "exactly the same grey and the same
lighting as image 2". `ImageStitch` [bodies | portrait] -> 1792x1120. No mask, no shared canvas.
One `MpiClearVram` at the end (none between the passes, so Klein stays loaded). ~48 s warm.

- Portrait = pass 1 untouched: front sx/sy 0.98-0.99 (B fixed); 3/4 turn + smile 3 of 3 (A fixed).
- Body views: two, inside the left half, 6 of 6; wardrobe matches the portrait (the 3/4 poncho
  becomes a long coat + scarf, as the one-shot sheet did too).
- Join: background step <= 5.8/255 on all 6 (plain stitching without the portrait reference:
  up to 21). Not visible.
- Flaw: a faint tone line BETWEEN the two body views on s976 (the pass-2 prompt had lost "the
  grey background flowing continuously behind both"). Re-run with it restored on three NEW seeds
  (T6b) to confirm.

## 2026-10-08 - batches 9-11, T6 on three NEW seeds (7 / 2024 / 31337) + the join

- **T6b (the phrase restored):** front sx/sy **1.000 / 0.991 / 1.009**; 3/4 turn + smile 3 of 3;
  two body views 6 of 6; the line between the body views gone. The JOIN still steps on 2 of 6:
  front s7 13/255, s31337 12/255 - visible on a close look (the body half vignettes darker).
- **T6c (+ "Extremely even frontal illumination, soft open shadows, uniform brightness from edge
  to edge" in pass 2):** 3/4 join <= 6/255 (was 8.8), front s7 / s31337 unchanged (13.6 / 10).
  Kept: `research/bench-tools/two_pass.py` builds exactly this graph (asserted equal to the run one).
- **T7 (pass 2 on a 1024-wide canvas whose right 128 px are the portrait's own edge, held by a
  noise mask, then cropped to 896):** WORSE - join 9-19/255 the other way, and the back view's
  hand touches the cut. Out. A noise-masked hold does not carry its tone over at 4 steps.
- **State of the fix:** stretch (B) and turn (A) are fixed by T6 on 12 of 12 runs. The faint
  step at the join (~1 in 3 seeds, <= 14/255): Fabio, 2026-10-08 - "there is no issue with that".

## 2026-10-08 - batch 12, frontal picture -> forced three-quarter close-up (engine 0.39.0)

T6 graph rebuilt from the bench file against the live 0.39.0 `/object_info` (`convert.py` exit 0,
`two_pass.py`); only the pass-1 portrait prompt changes. Front 4:5 crop, seeds 42 / 7 / 2024.

- **Engine bump check:** T6 baseline, front s42: sx/sy **1.000**, NCC 0.988 - the fix holds on 0.39.0.
- **F1 descriptive** ("the head and shoulders turned three-quarters toward the left side of the
  image ... both eyes visible, far cheek partly hidden", then the keep list), **F2 instruction**
  ("Turn the person's head and shoulders three-quarters toward the left ..."), **F3 camera orbit**
  ("photographed from a three-quarter angle, the camera moved 45 degrees ..."): **turned 9 of 9**,
  same side every time (brow piercing stays on the near side). The wording barely matters: one
  seed gives near the same picture under all three.
- **Likeness (eye; no face-embedding model on the bench):** a redraw, not a copy, but the same man
  - brow + lip piercings, ear stud, neck tattoo, goatee, hat and shirt all kept. Skin a little
  smoother.
- **Flaw: s2024 invents hair under the hat** on all three prompts (a braid; F3 full dreadlocks),
  and pass 2 copies it into the back view. Suspect our own tail "hair fully visible from the
  crown down": a copy has nothing to add, a redraw adds hair to satisfy it. Batch 13 tests it.

## 2026-10-08 - batch 13, hair fix + which side to turn

Tail now "the whole head inside the frame, the hair and headwear exactly as in image 1". New
input `input/mpi1042_threequarter_4x5_flip.png` = the 3/4 crop mirrored (faces image-right; both
originals face image-left, so only the mirror can catch a flipped side).

- **H = F1 + hair fix, front:** turned 3 of 3. s1234 / s31337 clean; **s2024 still grows a small
  braid in the portrait, but the back view stays short-haired** (was dreadlocks). Better, not gone.
- **N = side-neutral** ("turned three-quarters to one side, toward the side the face already
  leans in image 1"): front picture -> turned image-RIGHT on both seeds and over-rotated to near
  profile; 3/4 left-facing -> kept the side on s42, **flipped it on s2024**; mirrored -> kept 2 of
  2. Klein cannot read "the side it already leans": unreliable. Out.
- **H on the mirrored picture:** turned it the other way (to the left), as worded.
- **Every forced-turn prompt drops the smile on the 3/4 picture** (N tq / tqflip 4 of 4, H 1 of
  1); T6's copy prompt kept it 6 of 6. A forced turn is a redraw, and a redraw loses expression.
- **Verdict:** a fixed side ("toward the left side of the image") turns a FRONTAL picture 12 of 12
  with the likeness kept (eye). An already-turned picture is better served by T6's copy prompt
  (turn + smile kept). One prompt cannot do both: the graph needs to know which picture it got.

## 2026-10-08 - batch 14a, can the describer tell frontal from turned? (Fabio's idea)

The app's LOCAL describer (`comfy_workflows/image_descriptor.json`, Qwen3-VL 4B), the question wrapped
exactly as `llmService.buildDescribeInjectionParams` does, run by `research/bench-tools/pose_quiz.py`:
"Look only at the person's head. Is the face pointing straight at the camera, or is the head turned
to one side (a three-quarter or profile view)? Reply with one word: FRONT or TURNED."

- **6 of 7 right, one clean word each, 2-6 s:** front 4:5 crop FRONT; 3/4 crop, mirrored 3/4 crop,
  Klein's F1 three-quarter portrait and N near-profile portrait TURNED; Klein's frontal T6 portrait FRONT.
- **The miss: the UNCROPPED torso shot** (`16eeba8c...jpg`, small face, mild turn) -> FRONT, while its
  4:5 face crop -> TURNED. Ask on the boxed face crop the Flow already makes, never the whole picture.
- `describeImage({ imagePath, question })` (`js/services/llmService.js`) already serves both describe
  backends (local queue / endpoint) and never rejects, so the Flow can ask before dispatch.

## 2026-10-08 - batch 14b, Qwen-Image 2.1 (Fabio: if it wins, Klein goes)

MPI-936's bench graph imported read-only (`research/bench-tools/qwen_sheet.py`: picture 1 the only
reference, the canvas repointed at the empty latent at sheet size, MpiClearVram at the end); int8
transformer + Qwen3-VL 8B encoder, euler/simple 25 steps cfg 1. Same pictures, prompts and seeds
as Klein (hair-fix tail).

- **ONE sampling, whole 1792x1120 sheet (63-72 s; Klein two-pass ~48 s):** three views held 7 of 7,
  no ghost figures, no invented hair on any run.
- **Stretch gone without two passes:** front copy s42 sx/sy **1.010**, NCC 0.986 (Klein one-shot
  0.93-0.96). Qwen does not squeeze the portrait the way Klein does.
- **3/4 picture, copy prompt: turn AND smile kept 3 of 3** (Klein one-shot 1 of 3; Klein needed T6),
  poncho and gold-band hat kept, front body view smiles too. Background a little warmer / darker.
- **Frontal picture, turn asked INSIDE the sheet: only a mild turn 3 of 3** - not the three-quarter
  Fabio wants. Batch 15 tries stronger wording.
- **Portrait alone (896x1120, 27-33 s), turn asked: three-quarter 3 of 3**, piercings / tattoo / hat
  kept, no braid on s2024 (Klein grew one). Likeness on a par with Klein's by eye.
- **Licence (MPI-936 brief):** the Qwen Research Licence has NO outputs clause - images made with it
  are not commercially usable; Klein 9B's FLUX NC licence frees the images. Weights ~17.3 GB set.

## 2026-10-08 - batch 15, Qwen one-shot sheet with a stronger turn

Portrait sentence rewritten: "The right half of the image is filled by a three-quarter view head and
shoulders portrait, not a frontal one: the head and shoulders turned 45 degrees toward the left side
of the image, the face at a three-quarter angle with the far cheek partly hidden and the near ear
fully visible, with the same face, features, piercings, tattoos and expression as image 1, ..."
(rest as batch 14). Front picture, seeds 42 / 7 / 2024, 63-69 s.

- **Three-quarter turn 3 of 3 inside ONE sampling** (s2024 a little shallower), same side every time,
  brow + lip piercings, ear stud, neck tattoo and hat kept, no invented hair, two body views 3 of 3.
- So on Qwen the whole sheet - stretch, kept turn + smile, forced turn - is one sampling. The
  describer's FRONT / TURNED answer would pick between this sentence and the copy sentence.

## 2026-10-08 - batch 16, Qwen at higher resolution (Fabio: "like we did on Klein")

Seed 42, the batch 14b copy prompt (3/4 picture) and the batch 15 turn prompt (front picture), against
the batch 14b/15 runs (reference ~1 MP = `resolution` 1024, sheet 1792x1120, 63-72 s):

- **Reference ~2 MP (`resolution` 1408, Klein's picture-1 size), sheet 1792x1120: 90-93 s.**
- **Reference ~2 MP, sheet 2048x1280: 108 s.** The portrait comes out framed tighter (hat to the edges).
- **No detail gain:** face sharpness (Laplacian variance, crop resized to 600 px) 111 / 107 / 101 on
  the 3/4 sheet, 84 / 87 / 89 on the front sheet - flat within 5%; by eye the same picture.
  Composition, turn, smile and piercings unchanged. Klein's gain came from leaving 1280x800; Qwen
  already runs at Klein's final 1792x1120, and its reference size does not show in the output.
- **Keep Qwen at 1792x1120 with the 1 MP reference** (+40-70% time buys nothing visible).
  Contact sheet: `research/qwen_resolution.jpg` (left to right: 1 MP ref, 2 MP ref, 2048 sheet).

## 2026-10-08 - bench graph v2 (batch 17): two LiteGraph files, proven on the bench

`research/bench-tools/build_bench_v2.py <dir>` writes `MPI-1042_character_sheet_v2_klein.json` (T6 two
samplings) and `..._v2_qwen.json` (one sampling, `SplitImageWithAlpha` drops the 251-255 alpha), now in
`G:/ComfyUi/ComfyUI/user/default/workflows/`. Both: `Input_Face_Turned` (MpiSimpleBoolean) picks copy vs
three-quarter wording, v1's optional body branch kept. `convert.py` against live 0.39.0: exit 0, every
link resolved (65 / 40 executable nodes). Posted with `research/bench-tools/run_api.py`:

- **Klein, front, turn, s1234: portrait half PIXEL-IDENTICAL to the tested H run** (max diff 0); the
  body half differs slightly (mean 2.8/255) - the joined pass-2 prompt now carries `[CHARACTER PROMPT]`,
  so an empty user text leaves a double space. 66 s.
- **Klein, 3/4, copy, s7:** turn + smile kept; vs T6c (run on the old 0.34.2 engine) mean 2.7/255. 51 s.
- **Qwen, front, turn, s42 / 3/4, copy, s42:** same pictures as batches 15 / 14b by eye (mean 1.6-2.6/255,
  the same double space). 75 / 69 s. Output RGB.
- **Body mode smoke (torso shot as Picture 2):** both execute the SAM3 branch (66 / 94 s). Neither dresses
  the body views cleanly in Picture 2's clothes - Klein drapes the poncho as a stole over picture 1's
  shirt, Qwen keeps picture 1's shirt and takes only the jeans / belt / boots; both portraits wear
  picture 1's shirt. The body-mode test proper (with a real full-body picture) is still open.
- Contact sheet: `research/bench_v2_check.jpg`.
