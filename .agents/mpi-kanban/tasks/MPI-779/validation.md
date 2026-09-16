# MPI-779 validation

## Root cause

`routes/shared.js` registered `exit`/`SIGINT`/`SIGTERM` listeners at require time, and the
signal ones called `process.exit()`. `server.js` requires it before registering its own
`SIGTERM`/`SIGINT` handlers, so Node ran shared.js's first and the process was gone before
`cancelAllDownloads()` or `cleanComfyUITempFiles()` ran. A library module owning process
exit was the defect; the handler order only exposed it.

## Fix

- `routes/shared.js`: keeps the `exit` safety-net kill; the signal handlers become
  `installShutdown(stopServerWork)`, called by the entry point. Order: server work
  (`cancelAllDownloads`), owner-gated scratch clean while `activeComfyProcess` still proves
  ownership, `stopComfyUI()`, `process.exit(0)`. Same order as main.js (before-quit clean,
  then quit kills the fork).
- `server.js`: `installShutdown(cancelAllDownloads)` replaces its two dead handlers.
- `docs/worktrees.md`: the shutdown path and its order.

## Evidence

- `tests/fork-shutdown.test.cjs` (4 tests, child processes, scratch engine root):
  red before the fix (`installShutdown is not a function`, and `>1 1` listeners from a bare
  require of shared.js); green after. Bite check: moving `stopComfyUI()` before the clean
  turns both signal tests red (`staged present: true`).
- Live smoke on the real `server.js` (port 3791, scratch APP_USER_DATA / engine / models
  roots, wrapped `cancelAllDownloads`, fake engine handle, `process.emit('SIGTERM')` after
  listen): one listener per signal, `cancelAllDownloads ran`, `engine killed SIGKILL,
  output emptied: true`, `exit 0`.
- `npm test`: 1190 tests, 0 fail.

Not testable on Windows: a real OS SIGTERM (Windows terminates without running handlers),
which is why main.js's before-quit clean stays the Windows path.
