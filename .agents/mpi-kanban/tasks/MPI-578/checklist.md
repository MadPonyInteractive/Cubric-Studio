# MPI-578 Checklist - Upscale Video Flow: LTX 2.5 tile upscale + MiniMax H3

Scope and traps: `brief.md`. Bench runs take the GPU lease.

## 1. LTX 2.5 tile upscale - test (Route B)
- [ ] Fetch Refine Details + Restore IC-LoRAs and the Lightricks TiledFusion workflows; check the Refine Details model card vs the Pixel-Spatial-Upscaler
- [ ] Get the tiled workflow running on the bench (unpack the subgraph, our 2.5 model build)
- [ ] Side-by-side vs today's 2.3 Flow, same clips: AI-generated clips first, then a degraded real clip
- [ ] Record time end-to-end, peak VRAM, system RAM, tile size, output size (HD / 2x / 4K)
- [ ] Generic vs specific prompt on tiles: does the Flow need to write the prompt?
- [ ] Fabio's eye-test -> decision: REPLACE the 2.3 engine, ADD beside it, or fall back to Route A

## 2. MiniMax H3 upscale - integrate (done first, Fabio 2026-10-29)
- [x] Graph `comfy_workflows/flow_h3_upscale.json` (41 nodes, built by `research/build_h3_upscale.py` from flow_h3_extend + minimax_h3_fl2va nodes): 24 fps, trim to 17k+5, MpiCrop /32, MpiH3EncodeAV, H3 latent upscaler 2x (target dimensions), fl2va DiT + fl2v turbo LoRA, 3-step ManualSigmas `Input_Sigmas`, MpiWindowedSampler, source audio passed through. No KJ nodes.
- [x] Keyframe trap does not arise: conditioning built at the TARGET size with no keyframes
- [x] Upscale dimensions: `target dimensions` mode, 2 x the /32 fit on both sides
- [x] `ltxSigmasInjector` scales the graph's BAKED schedule (LTX default unchanged; other rungs within 1e-4; cap 1). Test `tests/ltx-sigmas-injector.test.cjs`. `flow-model-choice` anchoring skips injector-consumed and hidden-on-this-arm fields.
- [x] Bench run 1 (2026-10-29, G:\ComfyUi on :8190, lease): 288x512 -> 576x1024, 39 frames, audio through, 60 s, PASS mechanically (`research/h3_run1.out`)
- [ ] **H3 default sigma is WRONG for a foreign clip.** At the baked 0.9035 start (our H3 workflows' refine) H3 re-imagines the clip: same room, pose and camera, a DIFFERENT person and clothing. Run a start-sigma ladder (e.g. 0.35 / 0.45 / 0.55 / 0.65) on 2-3 clips (an H3 generation + a real clip), pick the start where identity holds, re-bake `Input_Sigmas` at it. Fabio eye-tests.
- [ ] Then re-apply the PARKED wiring: `git apply research/h3-arm-wiring.patch` (byModel `minimax-h3` -> flow_h3_upscale.json, requiredModels slot, Prompt strength `hiddenWhen` H3, description, flow-legs snapshot, doc row) + the two asserts noted at the patch's end. Parked so master never offers the drifting arm.
- [ ] Raw LiteGraph twin `comfy_workflows/raw/flow_h3_upscale.json` (load the API graph in the bench UI, save) - not made yet
- [ ] History Upscale dropdown (plugin) stays LTX-only by design (no flowModelIds); decide if it wants H3 too

## 3. Ship
- [ ] Both routes run end-to-end in an isolated app, with queue row, progress and Stop
- [ ] Docs + UNRELEASED line; dev-gated with the LTX 2.5 release (MPI-1267)
