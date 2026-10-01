# MPI-513 Validation

## Phase 1 (D1-D5) — 2026-10-01, Agent 84

- `npm test`: 2633 tests, 0 fail, 2 skipped.
- `node tests/install-store.test.cjs`: 33/33 (4 new D2 tests, red before the store change).
- `node tests/install-reconciler.test.cjs`: 16/16 (D4 contract; 4 new + 3 rewritten, red
  before the reconciler change).
- `node --test tests/install-start-settles.test.cjs`: red with the start-path rollup removed,
  green with it.
- Live, isolated instance (`app:isolated`, `CUBRIC_ENGINE_ROOT` + `CUBRIC_MODELS_ROOT` in
  scratch, log confirmed the scratch root): two synthetic models sharing a 64 MB weight —
  B attaches to A's in-flight record, both `done`; a 260 MB dep cancelled at 44 MB — job
  gone, restart clean, `done`; re-install of an on-disk model — `done` at once. app.log for
  the run: zero `Illegal transition`, zero ignored-record lines.

Open: live REMOTE resume on a Pod (costs money, needs Fabio's yes with a price); Phase 2
(MPI-497 / MPI-397 re-test in the app).
