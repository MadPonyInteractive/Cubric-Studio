# MPI-623 checklist

Derived from [plan.md](plan.md) by `mpi-continue` when implementation resumes. The bake-era
ticks (Phase 0/0b/1, all complete) moved verbatim to
[research/checklist-history-bake.md](research/checklist-history-bake.md).

## Phase 2: Engine nodes and ops

- [x] MpiNodes code: vendored MoGe v1 + `MpiPanoDepth`, `MpiLiftDepth`, `MpiWrapPad/Crop/Soften/CutMerge`,
      CPU unit tests 9/9, CPU parity (vendored == SplatKit's MoGe; pano vs spike npz mean 0.77%),
      whole-pack smoke (2026-10-07, validation.md § Phase 2 MpiNodes) - MpiNodes `3e8d7d2`, not pinned
- [x] Bench GPU run: pano depth on the GPU + lift fit error per step vs `chain_ring8k_gen.log` (lease)
      (2026-10-07: pano mean 0.77%, 46 s; lift == log on all 8 steps - validation.md § Phase 2 bench, GPU half)
- [ ] Ship: commit + push the pack, pin `dev_configs/node_lock.json`, MoGe safetensors on R2 as a dep
      (2026-10-07: safetensors made + hashed, dep `moge-vitl` written, Pod `start.sh` maps `moge`;
      left: R2 upload, HF re-host, `publish-runtime.sh dev`, the pin - validation.md § Ship, GPU-free half)
- [ ] Universal ops `sceneConvert` + `sceneLift` in the 4 registry files, live dispatch on `app:isolated`
      (2026-10-07: graphs + `runSceneOp` + registry + `tests/scene-ops.test.cjs` done, both graphs live on
      the bench match the spike; left: the dispatch through the app, after an engine restart on the new pin)

## Parallel Batch: Scene workspace shell + Convert

- [x] Shell: `PAGE_SCENE`, `MpiSceneBlock`, `MpiSceneCanvas` (GL teardown), dev_mode intercept,
      disabled Convert to 360 pano row (2026-10-07, validation.md § Scene workspace shell)
- [ ] Convert enabled + wired to `sceneConvert`, writes `scenePath` (after Phase 2)
      (2026-10-07: wired + route + tests green; left: one real Convert in the app after an engine restart)
