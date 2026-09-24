# MPI-902 validation

Verify mode: auto. All checks run 2026-09-24.

- `node --test tests/driver-floor.test.cjs tests/gpu-detect-once.test.cjs tests/curated-python-deps.test.cjs tests/comfy-stage-media.test.cjs tests/engine-scratch.test.cjs` -> 17/17 pass.
- `npm test` -> 1847 tests, 0 fail (1 skipped, 1 pre-existing `todo` for MPI-867).
- Live, this box: `readEngineTorchCuda(getPythonBin(engine))` -> `13.0` (torch-2.13.0+cu130);
  `resolveDownloadConfig().gpu.cudaVersion` -> `13.4` from the r617 `CUDA UMD Version:` header
  (was `unknown` before the regex fix).
- Route wiring (scratch harness, fake engine root with a cu130 dist-info, nvidia-smi stubbed to
  an r560 `CUDA Version: 12.6` header): `POST /comfy/start` -> HTTP 500
  `{"error":"Your NVIDIA driver is too old for the local engine: it supports CUDA 12.6, the engine needs CUDA 13.0. Update your NVIDIA driver (version 580 or newer, ...)"}`.
  The client already maps a non-ok start to `ui:error` "ComfyUI failed to start" with that
  message (`comfyController.js` ~line 485).

Not verified: the dialog on a real old-driver box (the field tester already updated his driver).

- CI: Tests run 35998110320 on 7984c3e1 -> completed success. Claim audit: 0 FALSE, 14 proven, 4 live-only readings.
