# MPI-1144 brief

Breaker, filed unasked by the MPI-1142 session (2026-10-14).

## What the user saw
Closing the app showed "Cubric Studio failed to start" with:
`uncaughtException: Error: EPERM, Permission denied: ...\ComfyUI\input\mpi_staged`
at `cleanEngineScratch` (routes/engineScratch.js:37) <- `cleanSessionTempFolders` (main.js ~208) <- `before-quit` (main.js ~1561).
app.log 2026-10-14T19:26:22Z (Fabio's live source run).

## Root cause (found, not fixed)
- `before-quit` empties the engine's input/ and output/ synchronously while the engine (and the server fork) are still ALIVE. The engine only dies after main exits (libuv job object; `serverProcess.kill()` runs on `quit`, later). MPI-778's own premise ("its quit ends that engine, so nothing left there can still be consumed") is broken by that order.
- A staged file (a HARDLINK to a project picture, `mpi_staged/f24bf54266b542b1.jpg`, link count 2) could not be deleted: something alive held it open. Minutes later, with the app gone, the file was deletable (it had already vanished). Likely holder: the engine (ComfyUI LoadImage never closes its PIL image; an MPO/phone JPEG keeps the fp open) or the server (sharp/libvips holds inputs open on Windows). Not proven which.
- The throw is uncaught, so `reportFatal` shows the START-failure dialog on quit.
- The server's SIGTERM path (`routes/shared.js` installShutdown) has the same order: clean, then kill. Twin.

## Direction
- `routes/comfy.js` already empties `mpi_staged/` when this app spawns the engine (`/comfy/start`): nothing can be consuming then. Moving the input/output clean to spawn time (or after the engine has exited) removes the race; the quit-time clean then goes. Decide what may stay on disk between sessions (output/ can hold big files).
- Fix both twins in one pass. Read `.claude/rules/root-cause.md` first; a try/catch around rmSync alone is a symptom patch.

## Noticed
