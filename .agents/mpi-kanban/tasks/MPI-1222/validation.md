# MPI-1222 validation

## Automated (2026-10-21)
- `node --test tests/engine-restart-now.test.cjs tests/engine-restart-schedule.test.cjs tests/cue-dispatch-stall.test.cjs` - 11 pass / 0 fail.
  Real generationService: the lane's running job ends `generation:cancelled` (byUser), the other lane is untouched, the queued job behind it is promoted (kept). Source pins: radial -> `_restartEngineNow` (no queue wait), Settings -> `_restartEngine` (MPI-805 wait), local cancel sits between `/comfy/stop` and `/comfy/start`.
- eslint on the three touched js files: clean.
- `npm test`: 3489 tests, 3487 pass, 0 fail.

## Live (Fabio) - PASSED 2026-10-21
First try showed the old "Restart scheduled" toast: his app started 02:49:44, the edit landed 02:50:37 (old code). After an app restart: "radial restart works now".
