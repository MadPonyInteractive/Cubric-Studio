# MPI-1192 validation

## The report
Fabio stopped a local Qwen-Image 2.1 control run near the end (2026-10-19 ~00:20Z, dev app, RTX 4060 Ti 16 GB, ComfyUI 0.41.0) and got the "Generation failed" dialog: `KSampler failed: torch.AcceleratorError: CUDA error: an illegal memory access was encountered`.

## Root cause
- Engine (upstream): the interrupt landed inside the TAESD preview decode; execution.py's finally ran `cleanup_malloc_graph()` (log: `Comfy model compiler graph breaks: 0, rogues: 0`), which drops the malloc graph's VRAM with no synchronize while the step's kernels are in flight; `reset_cast_buffers()` -> `torch.cuda.synchronize()` then raised the illegal access and the process aborted (`ComfyUI process exited (code=3)`). Upstream issue Comfy-Org/ComfyUI#17115, fixed on master by Comfy-Org/ComfyUI#17178 (2026-10-18), not in v0.42.0.
- App (ours): ComfyUI answered the Stop with `execution_error`, so runWorkflow rejected. runGifCutoutTrack's catch checked for the Stop first; runCommand's and runAutoMask's did not and opened the bug dialog.

## Fix
`js/services/commandExecutor.js`: runCommand's catch ends a stopped job through `_abortedBail` (cancelled terminal, `cancelled_before_dispatch` sentinel); runAutoMask gates its dialog on `_cancelled`.

## Evidence
- `tests/stop-after-engine-fault.test.cjs`: 2 of 3 fail against HEAD's commandExecutor (catch at line 1340 reaches ui:error without checking the Stop), 3/3 pass with the fix.
- `npm test`: 3412 pass, 0 fail. eslint clean on the file.
- Commit 91f2d55d5 pushed; CI run on it: see the close-out event.

## Engine after the fault
The process died with its CUDA context; the next generation re-spawns it (comfyController -> /comfy/start). The MPI-1024 safer-memory restart does not trigger (its regex matches aimdo allocation failures only). The crash repeats on a mid-sampling Stop until the engine pin carries #17178.
