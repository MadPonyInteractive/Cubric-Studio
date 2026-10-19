# MPI-1204 - engine upgrade has no re-entry guard

Found 2026-10-19 during the 2.1.1 update test (Version 2.1 readiness 10). Present in 2.1.0; not
caused by 2.1.1.

## What happened

Test install `D:\CVTest\CubricVision-v1.5.0-to-v2.1.1b` (published 1.5.0 + 2.1.1 update, engine
stamped 0.34.0). Its log (`user-data\logs\app.log`, 2026-10-19T17:53-17:56Z):

1. 17:53:56 `Upgrading engine in place to 0.42.1` - the app's own, started by
   `MpiEngineInstall` in `upgrading` mode (`MpiEngineInstall.js` ~611 POSTs `/engine/upgrade`
   as soon as the modal shows).
2. 17:54:00 a SECOND `Upgrading engine in place` (the test script's own POST).
3. pygit2: `failed to create locked file .../ComfyUI/.git/refs/tags/v0.42.1.lock: The file exists`.
4. `Full engine reinstall - the in-place upgrade failed`, `Removing old ComfyUI portable` - while
   the first upgrade was still using that tree.
5. The first then failed on a missing `requirements.txt`, the models migration hit ENOENT on
   `ComfyUI\models`, `spawn ...python.exe ENOENT`, and the server exited 1: "Cubric Studio failed
   to start" plus "Installation Failed".

## Why it matters for users

`POST /engine/upgrade` (`routes/engine.js` ~1190) answers `upgrade-started` and runs with no
in-flight check; `beginEngineJob()` is only the quit guard. Any second trigger - a window reload or
renderer restart while the modal re-shows in `upgrading` mode, a double click, an agent calling it
- runs a parallel upgrade, and the failure path WIPES the engine (multi-GB re-download, or a dead
app as above).

## Done when

A second `/engine/upgrade` while one runs attaches to (or is refused by) the running job and never
starts a parallel checkout or wipe; a test proves two overlapping POSTs run ONE upgrade. Check
`/engine/repair-deps` and the install route for the same gap.
