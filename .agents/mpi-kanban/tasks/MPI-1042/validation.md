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
