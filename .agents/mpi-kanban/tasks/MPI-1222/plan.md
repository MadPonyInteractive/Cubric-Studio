# MPI-1222 - Dev radial Restart engine restarts NOW

## Approach
- `generationService.js`: export `cancelRunningOnLane(lane)` - the queue's own Stop (`cancelRunningCueJob`) for that lane's running job, so the row ends visibly as cancelled.
- `navigation.js`: radial `restart-engine` calls a new `_restartEngineNow()` - no idle probe, no scheduling. `_performRestart` takes an `onStopped` hook: local = after `/comfy/stop` + the 2 s exit wait (a promoted pending job then meets a stopped engine, and the gen gate starts it); remote = before `/proxy/restart-comfy`.
- Settings (`engine:restart`) keeps MPI-805's wait. `events.js` doc line drops "dev radial".

## Verification
**Verify mode:** user-ux
- Test: running job on the engine lane is cancelled; other lanes untouched.
- Fabio: long generation running, dev radial Restart -> row cancelled, engine back in seconds, a new generation runs.

## Current State
Code + test done (11/11 targeted, eslint clean). Next: Fabio live check in his app, then close.

## Completed
- cancelRunningOnLane, _restartEngineNow, onStopped hook, events.js doc, tests/engine-restart-now.test.cjs

## Remaining Work
- Fabio's live check (needs an app restart / reload to pick up navigation.js).
