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

## Not yet seen

- A live DramaBox run on the fixed node. Fabio's app reinstalls the node on its own (the
  `.mpi_node_commit` marker reads 9ebb44be, the pin now 529c4be -> drift -> deps install); his
  MPI-1004 look runs DramaBox and is the live proof.

## Release consequence

A third-party pin move makes `scripts/engine-drift.mjs` `assessPinMove` return the blunt
"stale" verdict, so `release:check` refuses the 2.0 cut on the 2026-09-28 smoke evidence, and a
scoped smoke cannot merge into it (`smoke-workflows.mjs` `loadMergeBase`). The 2.0 cut needs a
full-matrix smoke (RunPod, money) or a gate change. Fabio's call.
