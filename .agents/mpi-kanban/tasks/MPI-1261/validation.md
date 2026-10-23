# MPI-1261 validation

2026-10-23, own `app:isolated` instance (port 52529, scratch profile + scratch project, 3 imported images), driven in the browser pane:

- Pointer resting on a gallery card: flyout NOT open at 1 s, open at 2.5 s, to the card's left, showing "Model Imported / Created 23 Oct 2026, 19:47".
- Pointer moved to empty grid space: closed within 0.5 s.
- Back to Projects (grid destroyed): `.mpi-entry-info` count 0, so no leaked flyout.
- History keeps its 400 ms (default `openMs` unchanged; only the gallery passes 2000).
- `npm run lint` clean; `npm test` 3556 pass, 0 fail.

Cleanup: instance stopped via the listener's parent; the scratch project root it added to `Documents/Cubric Studio/project-paths.json` removed (file restored byte-for-byte).
