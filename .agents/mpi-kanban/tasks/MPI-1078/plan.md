# MPI-1078 - plugin / Flow / engine files make a model read partial forever

## Rule (picked 2026-10-11)

A dep a plugin, a Flow or the engine (universal set: custom_nodes + `engineAsset`) needs is
dropped from a model's partial measure ONLY WHEN IT IS ON DISK. On disk, it is there for its
other holder, not as this model's progress; missing, it is still this model's real work.
That is Option A of the handoff with the on-disk test of `_sharedOwnedDepIds`, which removes
Option A's risk (a missing shared weight never leaves the denominator). Checked overlap:
only scene-path (umt5, wan_2.1_vae -> Wan 2.2 / 5B), minimax-music + engine (qwen3vl clip ->
Krea 2) and voice-changer (a custom node) overlap model universes; no transformer.

## Steps

1. `resolveModelDeps.js`: `depsHeldOutsideModels(deps, holders)` + `partialInstall(deps, status, held)` drops an on-disk held dep.
2. `MpiModelManager._computePartial` and `modelUpdateCheck` (toast + its 1 GB install proof) pass the same set.
3. Test in `tests/model-update-check.test.cjs`.

## Verification

**Verify mode:** auto

- `node --test tests/model-update-check.test.cjs`, then `npm test`.

## Current State

Done: shipped in df631df91, CI green (run 38130233149).
