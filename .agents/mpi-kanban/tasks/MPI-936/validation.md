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

## 2026-10-08 (session 2a01ba53)

- **In-app, `app:isolated` (own profile, port, scratch APP_DOCUMENTS; engine :48188 shared), via
  `/connector/generate`, GPU lease: PASS so far.** edit RGBA 65 s, RGBA **59% clear** (bench 59%), clean
  cut-out; edit 2 refs 55 s, RGBA opaque, image 2's jacket on her; i2i 24 s RGB (0.65 stays a photo, as on
  the bench); control depth 46 s RGB, bronze statue on her structure; upscale 51 s RGB 1536 (x1.5).
  Engine `/history` shows what ran: detail node 81 and USDU node 97 at **12 steps**, the rest 25; denoise
  0.65 / 0.3 and Input_Control_Net 2 injected.
- **The other three, same instance profile through an Electron harness (`_electron.launch`, launcher's env)
  that publishes a mask reader via `js/shell/activeMask.js` exactly as MpiGroupHistoryBlock does (an agent
  cannot paint): PASS.** t2i 31 s, RGBA **69% clear**, clean cut-out; inpaint 72 s RGB, plant placed in the
  box, no seam; detail 16 s RGB (24 s at 25 steps on the bench), face re-rendered, stitched invisibly. Both
  masked runs landed as new versions of the masked card (same groupId). **All seven ops PASS in-app; RGBA
  survives capture on t2i and edit.**
- **NC badge eye-test: PASS** (Fabio, "looks good"): moneyOff flag top-right of the tile, "Non-commercial
  licence" on hover.
- **Agent read-back: PASS after a fix.** Every op carried "the only model here that generates a transparent
  background"; five of seven return RGB. Moved to `qwen-image-2-1:t2i`. Agent tests 21/21.
- **`npm test`: 2789 pass, 0 fail, 2 skipped** (MPI-1045's test landed in 5938f6484).
- **`release:check`: was FAILING** (peer message b73155ff): the Pod yaml had no `model_patches`, so the
  ControlNet is invisible on a Pod. mpi-ci c57f7dd adds the line (pushed on Fabio's yes);
  `release:check` passes. Live on Pods only after `publish-runtime.sh dev` + a Pod test.
