# MPI-764 checklist

## Root cause (traced 2026-09-15)

An fs tracer on the test showed the leftover file is the dep's `.cubricdl` MARKER, written by
`markDownloadInProgress` inside `FileDownloader.download()` AFTER `fs.remove` had unlinked it
(10/25 traced runs failed; untraced baseline 3/10).

- `download()` is a multi-await prelude (ensureDir, stat, marker read, marker write) before it
  starts the NDH stream, and nothing in it checks for a stop. `cancel()` / `stopKeep()` called
  during that prelude stop nothing (or stop an NDH that is then restarted by `resumeFromFile` /
  `start()`), so the stream starts AFTER the cancel.
- `cancelAllDownloads()` is synchronous and never awaits the `stopKeep()` calls it fires.

Production reach: a user cancel (`dl.cancel()` in the cancel/uninstall route) or the ENOSPC
cancel-all in `server.js` that lands during a start's prelude lets a cancelled dep stream
anyway. SIGTERM/SIGINT exit the process, so they are unaffected either way. Remote installs run
on the Pod wrapper, not FileDownloader. `tests/remote-disk-gate-unknown-state.test.cjs` removes
no directory, so it does not share the teardown.

## Steps

- [x] `FileDownloader`: a stop flag set by `cancel()` / `stopKeep()`; `download()` checks it
      before starting a stream; `cancel()` / `stopKeep()` await the in-flight start first
- [x] `cancelAllDownloads()` returns a promise that settles when every `stopKeep()` has
- [x] Deterministic regression test: cancel during the prelude never starts a stream
- [x] `docs/download-manager.md` FileDownloader contract note
- [x] 10x solo `local-disk-gate-partial` + `npm test`
