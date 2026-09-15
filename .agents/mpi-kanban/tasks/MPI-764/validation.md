# MPI-764 validation

All runs 2026-09-15, Windows, Node 24.14.0.

## Root cause, measured

- An fs tracer (scratch copy of `tests/local-disk-gate-partial.test.cjs` logging every fs
  mutation under the sandbox root) failed 10/25 runs. Every failure left
  `diffusion_models/mpi756-<pid>-1.safetensors.cubricdl`: `fs.remove` unlinked the partial and
  its marker, then `markDownloadInProgress` (in `FileDownloader.download()`'s prelude) wrote the
  marker back, then `rmdir` hit ENOTEMPTY. `cancelAllDownloads()` had already returned.
- Deterministic repro of the production bug against the unfixed module (3/3 runs): a
  `cancel()` or `stopKeep()` landing while `download()` is in its prelude records
  `["stop","resumeFromFile"]` (the stream starts AFTER the stop) and, for `cancel()`, the
  marker it deleted exists again afterwards.

## After the fix

- Same repro: `["stop"]` for both, no marker after `cancel()`, 3/3.
- `node tests/download-completion.test.cjs` (new `testStopDuringStartPreludeWins`): passed.
- `node --test tests/local-disk-gate-partial.test.cjs` 10x solo: 0/10 failures (baseline 3/10).
- The tracer 25x: 25/25 clean (baseline 10/25 failing).
- `npm test`: 1044/1044.
- `node --check routes/downloadManager.js`; `eslint` on both changed JS files: clean.

## Sweep

- Stop sites on `FileDownloader`: `cancel()` (user cancel / uninstall route, awaited) and
  `stopKeep()` (`cancelAllDownloads`) both set the flag and wait out the prelude. `forceStall()`
  is the watchdog's error injection, not a stop; its retry must still restart, so it does not
  set the flag.
- `download()` re-entry points (`_startPendingDeps`, mirror failover, retry timer) all go
  through the same `_startStream()` checks.
- `cancelAllDownloads()` callers: `server.js` SIGTERM/SIGINT (exit immediately; unaffected) and
  the ENOSPC `unhandledRejection` handler (fire-and-forget; each stop has its own catch, so the
  returned promise cannot reject). The test's existing `await` now waits for real.
- Remote installs stream on the Pod wrapper, not `FileDownloader`, so there is no remote twin.
  `tests/remote-disk-gate-unknown-state.test.cjs` removes no directory in its teardown and does
  not share the race.
