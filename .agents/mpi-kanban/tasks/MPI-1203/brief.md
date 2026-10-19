# MPI-1203 - Queue: warn when a RUNNING job never starts

## What happened (2026-10-19)

In the History workspace, FLUX.2 Klein 9B upscale jobs sat on the Cue as one RUNNING row plus
pending rows. The status bar read IDLE, ComfyUI never logged `got prompt`, and app.log held
nothing for those jobs: no error, no warning. Cancelling everything cleared it, and it could not
be reproduced afterwards.

Ruled out:
- the prompt words and the child-safety gate (`legs and boots` passes `checkChildSafety` as `ok`, no picture look);
- Use Tiles with words: an isolated repro reached `/prompt`;
- a deleted input picture: the run bails cleanly with `Reused input asset missing`;
- an uncaught throw: `installErrorBridge` (MPI-899) writes those to app.log and none appeared.

What is left is an await that never settled between `_dispatchNextCue` handing the job to
`startGeneration` and the executor registering its store job. That window leaves `_lanes[lane].active`
set with no store job: a RUNNING row, an IDLE bar, nothing on the engine, nothing in the log.

## The change

When a dispatched job still has no store job on its lane after a stall window, log a warning that
names the operation, model and lane. This adds a trace for the next occurrence. It does not fix
anything: Stop still clears the lane, as before.
