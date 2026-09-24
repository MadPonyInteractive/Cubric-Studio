# MPI-902 plan - refuse to start the local engine on a driver too old for its torch

## Goal

When the NVIDIA driver cannot run the installed engine's torch CUDA build, the engine start
answers with a plain "update your NVIDIA driver to 580 or newer" instead of spawning a
process that is certain to die with `cudaErrorNotSupported` / access violation 3221225477.

## Findings (2026-09-24)

- Installed engine here: `torch-2.13.0+cu130`. CUDA 13 needs driver r580+; CUDA major
  versions have no cross-major compatibility, so driver CUDA major < torch CUDA major is a
  certain crash. Within a major, minor-version compatibility holds.
- `detectNvidiaGPU()` parses `CUDA Version:` from the bare `nvidia-smi` header. New drivers
  (r617 on this box) print `CUDA UMD Version: 13.4` instead, so the regex misses and the log
  reads `CUDA: unknown`. The old drivers this card is about still print `CUDA Version:`.
- `/comfy/start` already fails fast with a 500 + reason ("ComfyUI Python not found...");
  `comfyController.ensureServerRunning` turns that into a `ui:error` dialog titled
  "ComfyUI failed to start". No client change needed.

## Decision: warn by refusing the start, do not switch builds

The `cu126` legacy build would run an RTX 3060 on an r560 driver, but not a 50-series
(Blackwell needs cu128+), it is an unsmoked build matrix for our pinned nodes, and the build
is fixed at install time so a later driver update would leave the user on it. A driver update
is free, takes minutes, and on the field box also cured the RunPod queue stall. So: block the
start with an actionable message; no build re-selection.

## Steps

1. `routes/platformEngine.js`: header regex accepts `CUDA (UMD )?Version:`; add
   `readEngineTorchCuda(pythonPath)` (reads the `torch-*+cuNNN.dist-info` folder name under
   the engine's site-packages) and pure `driverTooOldReason(driverCuda, torchCuda)`.
2. `routes/comfy.js` `/comfy/start`: after the python-exists check, if the GPU is NVIDIA and
   `driverTooOldReason` returns a message, log it and answer 500 with it.
3. Test `tests/driver-floor.test.cjs`: the pure function (12.6 vs 13.0 -> message, 13.4 vs
   13.0 -> null, unknowns -> null), the torch dist-info read on a temp dir, and the header
   regex on both header formats.

## Verification

**Verify mode:** auto

- `node --test tests/driver-floor.test.cjs tests/gpu-detect-once.test.cjs` passes.
- Live: `readEngineTorchCuda` on this box's engine returns `13.0`; the r617 header parses to `13.4`.

## Current State

Steps 1-3 done and verified (see validation.md), plus a `docs/comfy.md` entry. Next: close-out
(commit by pathspec, close on green CI). Open question for the user: `.claude/rules/comfy_engine.md`
still says CUDA is "informational + tiebreaker only" - needs a one-line update, rule edits need permission.

## Completed

- Steps 1-3; docs/comfy.md "Driver floor is checked at START" entry.

## Remaining Work

Close-out only.

## Plan Drift
