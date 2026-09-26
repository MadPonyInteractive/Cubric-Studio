# MPI-940 validation

## Phase 1: the send window

2026-09-26, session 5cae2625 - automated checks PASSED:
- `node --test tests/cloud-executor.test.cjs` -> 30/30 pass, incl. new: shipped window is 3000 ms;
  Stop at 50 ms into a 1200 ms window -> `cancelled_before_dispatch`, phase CANCELLED, ZERO
  calls to `/deepinfra/generate`; no Stop -> exactly one POST at >= 1150 ms, countdown ticks [2, 1, 0].
- `node --test tests/cloud-price-tag.test.cjs tests/deepinfra-collage.test.cjs tests/lane-agreement.test.cjs` -> 24/24.
- `npx eslint --max-warnings=0` on the 3 changed js files -> exit 0.

VERIFIED by Fabio in his app, 2026-09-26: Stopped a cloud run inside the window; a local SDXL
generation ran as before; a full cloud generation left to finish landed normally.

## Phase 2: prompt-box cloud batch of N

2026-09-26, session 5cae2625 - automated checks PASSED:
- `node --test "tests/**/*.test.cjs"` -> 1958 pass, 0 fail.
- New in `tests/cloud-executor.test.cjs`: batch 4 on nano-banana-pro-cloud = 4 POSTs of batch 1,
  seeds 42..45, per-card `info.seeds`, cost share sums to the bill, every call carries the whole
  batch's `estimateUsd`; 2 of 4 failing lands 2 + one "2 of 4 did not come back" warning; all
  failing = one error dialog; Stop inside the window on a fan-out = zero POSTs.
- `tests/cloud-price-tag.test.cjs`: no-native batch of 4 now quoted as 4x one (was 1x, MPI-852).
- `tests/connector-named-params.test.cjs`: agentCanBatch = SDXL t2i + every cloud op.
- `npx eslint --max-warnings=0` on the 4 changed js files -> exit 0.

Pending: Fabio in the app (user-ux) - batch control on a no-native cloud model, N cards at once,
N results; Stop in the window bills nothing.
