# MPI-936 Validation

Gates, in order: graph proven on the bench (`G:\ComfyUi`, 0.39.0) per op; one in-app generation per op;
RGBA survives capture; `npm test`; agent read-back; Fabio eye-tests the NC tile flag and the preview.

## 2026-10-08 (session 6271e0b6)

- **Bench, all seven ops: PASS.** `research/bench/run.py` under the GPU lease, outputs eyeballed on contact
  sheets (`research/bench-results.md` runs 2-3): t2i (RGBA, 64% clear when asked), edit 1/2 refs, edit RGBA
  (59% clear), i2i (0.65 nudges, 0.85 restyles), control depth + pose, masked edit + inpaint via LanPaint
  (no seam), detail, upscale 1.5x (Siax crosshatch = the upscaler's, app-wide, Noticed).
- **Raw -> runtime faithful: PASS.** `comfy_workflows/qwen_image_2_1.json` (84 nodes) diffed node-by-node
  against `graph.py`'s API: identical but for two optional ControlNet widgets taking defaults (0 / 1).
  `validate-injection-rules.mjs`: conforms. Raw committed by the sync (541caee9a).
- **`npm test`: 2779 pass, 1 fail, 2 skipped.** The fail is `tests/remote-engine-assets.test.cjs`
  asserting `qwen3vl-abliterated-clip` is an engineAsset: a peer's in-flight MPI-1045 edit (claim
  9ac7a7c7-mpi1045), not this card's files. Re-run once that lands.
- **Not yet:** in-app run per op (isolated app), RGBA through capture, agent read-back + tests, Fabio's
  eye-test of the NC flag and the preview webp.
