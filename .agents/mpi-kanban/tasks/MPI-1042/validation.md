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
