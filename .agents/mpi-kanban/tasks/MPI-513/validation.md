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

## Live REMOTE test on a Pod — 2026-10-01, Agent 85 (Fabio's yes, cap $0.10)

Linux box, its B3 test install updated 1.6.2 -> 1.6.3 built from master `f03d26905` (mpi-ci run
36912841222; the bundle's `installStore.js`/`reconciler.js` checked for both fixes). Download-only
CPU Pod `cov1jclzypfz6j`, EU-RO-1, 10 GB volume `wibuwj892h`, driven through the app's own routes
(`~/b3/podtest.py`). Ready in 39 s.

- **Shared-dep attach:** A [taeh3, vae-sdxl] then B [vae-sdxl, ltx23-preview]: B's start showed
  vae-sdxl `downloading` at 267 MB (attached to A's record), both `done`, one plain model-level
  `download:complete` each (real downloads: toast is right).
- **Cancel + restart:** C [sam3-multiplex] attached to the connect heal (`engine:assets`) already
  fetching it; cancel dropped C (ABSENT), the heal's download carried on, restart credited the full
  1.75 GB and settled `done`.
- **App crash mid-install:** D [stable-audio-3-small-sfx 2.1 GB] at 422 MB, SIGKILL, relaunch,
  reconnect, re-POST: the Pod had finished it -> `{"alreadyInstalled":true}`, silent. R1 on remote.
- **Re-install of A on the Pod:** `{"alreadyInstalled":true}`. Every finished job (engine:assets, D,
  A) left the snapshot in turn; store empty 120 s after. R2 on remote.
- Teardown: Pod 404, volume deleted, account shows 0 Pods / 0 volumes. Two CPU Pods (the reconnect
  recreated one, below), 8.3 min total at ~$0.06/hr: **~$0.01 spent.**

**Two bugs found by this run:**
1. **Cancel starts a dead LOCAL downloader on a queued Pod dep (fixed here).** The cancel route runs
   the local pump `_startPendingDeps` unconditionally; with one record set the Pod deps queued
   behind the remote cap are `queued` records with no localPath. Live: `downloader.download()
   caught error for taef2-decoder: The "path" argument must be of type string. Received null`,
   then `stall watchdog: taef2-decoder ... forcing failure` every 15 s - on a big queued Pod dep that
   force-fails the install after 60 s. Pre-existing (1.6.2 makes the same call on the same queued,
   null-localPath records), not a Phase 1 regression. Fix: the pump skips `engine === 'remote'`
   records. `tests/remote-install-concurrency.test.cjs` new case red without it, green with it.
2. **Pod reconnect deletes a RUNNING Pod (MPI-894's lane, handed over).** v2 answers `start` on a
   running Pod with `action "start" is not valid for status "RUNNING"`, not the v1 400 the code
   treated as "already running" -> delete + recreate (`cov1jclzypfz6j` -> `4mrf5i8wamsz7g`).
   Session "Release 2.0 blockers 27" holds `routes/remotePodLifecycle.js` and is fixing it.
