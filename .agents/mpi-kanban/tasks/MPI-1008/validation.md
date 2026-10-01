# MPI-1008 Validation

## 2026-10-01 - fix proven offline, pinned

- Repro (scratchpad `repro_1008.py`, the engine's own python + ComfyUI v0.34): the fork's real
  `load_patchers` on a plain `nn.Linear` stack with free VRAM reported as 64 MB.
  - Before (fork `9ebb44b`): `FAIL: Expected all tensors to be on the same device, but got mat1 is
    on cuda:0, different from other tensors on cpu (when checking argument in method
    wrapper_CUDA_addmm); weights on {'cpu'}` - the exact error in Fabio's app.log.
  - After (`force_full_load=True`): `PASS: ran on cuda:0; weights on {'cuda:0'}`.
- Fork commit `529c4be4c5406d375f2b962e31c05efd762cf260` pushed to
  `MadPonyInteractive/ComfyUI-MelodramaBox` main (`git ls-remote` matches). NOTICE item 4 added
  (Apache-2.0 modified-file record).
- `dev_configs/node_lock.json` repinned to it. The pin's archive URL
  (`github.com/.../archive/529c4be....zip`) downloads (200, 316 KB) and its `patcher.py` carries
  the fix.
- `node --test` curated-python-deps + download-job-denominator + node-drift: 29/29 pass.

## Live + CI (2026-10-01) - closes the card

- CI: tests.yml run 36836574990 on `bff32c628` green.
- Fabio's app reinstalled the node at the pin by itself on restart (app.log 08:49:15Z "node commit
  marker stamped for ComfyUI-MelodramaBox"; engine `.mpi_node_commit` = 529c4be, `patcher.py`
  carries `force_full_load=True`).
- His DramaBox run at 08:50Z (MPI-1004 look, step 1: a voice line with a cough) PASSED by ear,
  every load `full load: True` (1504 / 6266 / 245 / 61 MB). VRAM was not tight on that run
  (8.41 GB used after Gemma), so the tight case stays proven by the offline repro only.
- Left for the 2.0 cut, recorded on MPI-595 B1: mpi-ci lock sync, DEV Pod image rebuild, smoke.

## Release consequence

A third-party pin move makes `scripts/engine-drift.mjs` `assessPinMove` return the blunt
"stale" verdict, so `release:check` refuses the 2.0 cut on the 2026-09-28 smoke evidence, and a
scoped smoke cannot merge into it (`smoke-workflows.mjs` `loadMergeBase`). The 2.0 cut needs a
full-matrix smoke (RunPod, money) or a gate change. Fabio's call.

Proven after the commit: `assessPinMove` on the 2026-09-28 evidence now returns
`stale: true, "a third-party node pin moved, and those packs are not checked out here to diff"`.

The Pod image BAKES MelodramaBox (`installRequirements: true`, `mpi-ci/cubric-vision-pod/Dockerfile`
bake loop), and `mpi-ci/cubric-vision-pod/node_lock.json` still pins `9ebb44be`. Until the Pod image
is rebuilt from the synced lock (`/build-pod-image`, a Docker Hub publish), a master or 2.0 build
on a remote Pod shows the toast "Pod image is stale - rebuild needed (ComfyUI-MelodramaBox)"
(`js/data/modelRegistry.js` `bakedDrift`) and Pods run the old node. Released 1.x apps pin the old
commit and see nothing.
