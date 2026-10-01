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

## Phase 2 re-test — 2026-10-01, Agent 85 (HEAD `8dc8c1d08`, Phase 1 in)

Isolated instance `:54072`, `CUBRIC_ENGINE_ROOT` + `CUBRIC_MODELS_ROOT` in scratch (log:
`free space — models root ... scratchpad\models`). Driver captured `/comfy/downloads/stream`.

- **MPI-497 symptom 1 SURVIVES.** Synthetic model on `4x-NMKD-Siax` (64 MB): first install
  emits per-dep then model-level `download:complete` (2.0 s). Re-install with the dep on disk:
  `download:started` progress 1, then model-level `download:complete {"modelId":...}` at once
  (4.8 s). That event is what `notificationService` toasts as "<model> installed." — nothing
  downloaded. Root: `_checkModelJobsComplete` broadcasts completion with no record of whether
  any dep transferred. Not a two-writer bug.
- **MPI-497 symptom 2 SURVIVES.** The job settled `done` at 14:20:23Z; a fresh SSE connect at
  14:22:32Z (129 s, past `DONE_TTL_MS` 120 s) still got it in `download:snapshot`, and
  `/comfy/downloads/status` still lists it. Root: the reconciler poll returns early when
  `!store.hasActiveJobs()` and the SSE-connect handler reconciles only while a job is active,
  so `pruneTerminal`'s TTL belts never run once everything has finished. The FE treats a
  lingering `complete` job as busy (MPI-241 `isBusy`) on any tile whose model is not installed
  — after a remote install and a switch to local, that is the 100% bar the card describes.
- **MPI-397: not re-tested, by construction.** Its residual (uninstall ~3 s on a Pod, measured
  2026-07-30) is the `/comfy/models/check` -> wrapper `models/status` round trip; Phase 1 did not
  touch that path. Still Fabio's product call (optimistic flip vs disk truth).

## R1 + R2 fixes — 2026-10-01, Agent 85

- R1: store marks `alreadyInstalled` (every dep on disk at registration; a re-POST adding a dep
  to fetch clears it); `_broadcastModelComplete` carries it; `downloadService` folds it into
  `data.silent`. R2: reconciler poll ticks while ANY job is held; SSE connect always runs the pass.
- `node tests/install-store.test.cjs` 36/0 (3 new); `node tests/install-reconciler.test.cjs` 17/0
  (1 new). Red/green: each new test FAILS with its fix swapped out (scratch `redgreen.py`).
- `npm test`: 2633 tests, 2631 pass, 0 fail, 2 skipped.
- Live, isolated `:50063` (scratch engine + models roots, log confirmed): first install of
  `taeh3-decoder` -> `download:complete {"modelId":...}` (toasts); re-install with it on disk ->
  `{"modelId":...,"alreadyInstalled":true}` (silent). The `done` job left `/comfy/downloads/status`
  at 14:38:17Z, 132 s after it settled, with no SSE connect and no other job.
