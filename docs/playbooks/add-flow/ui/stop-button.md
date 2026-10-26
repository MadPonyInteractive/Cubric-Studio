# The frame's Stop — one press stops everything the Flow started (MPI-1293)

Fabio, 2026-10-25: a Flow that queues several jobs (Storyboard's panels, Multi-angle's passes,
chained legs, stacked presses) took one Stop press PER JOB, up to ten. One press of the frame's
Stop (button and `generation.stop` hotkey, `MpiBaseFlow` `_cancel`) now ends every run the window
holds: running jobs, pending jobs, and whatever a run would queue next. This overrides MPI-822,
which left a stacked run's pending jobs to the queue's per-row Stop.

## How the frame does it

1. **Every queue job of this window, pending before running:** `cancelCueJobs(match)`
   (`generationService.js`, the order `cancelBatch` uses, so a lane drain cannot promote one of
   ours in between). A pending job lives ONLY in the Cue queue, never in `activeGenerations`, so
   no registry walk can reach it: that is why one press used to stop one job.
2. **Every run's handle:** a graph run's `FlowRun.cancel()` (MPI-1083) stops it while it is not in
   the queue (describing, in a cloud edit, between legs or passes); a driver run's handle flips
   `frame.stopped()`.

A job is the window's by `_isMine`: a graph run by its tempId (every leg and pass shares it), a
driver's job by its **queue id**. A job landing in a card's history has no tempId (`landingOpts`),
which is why Multi-angle's pass 2 showed no latents before this card.

## What a Flow must do

- **Graph Flow:** nothing. Its legs and passes share one handle.
- **Driver Flow:** check `frame?.stopped?.()` after the job's last `await`, right before
  `enqueueGeneration`, and return `{ ok: false, code: 'CANCELLED' }` there; report the job with
  `frame?.onJob?.(queued.queueJobId, done)`; return `{ finished }` so the frame stays busy, with
  Stop live, from the press to the last job. Between two jobs nothing is queued, so the check is
  the only thing that stops the NEXT one — [../README.md](../README.md) § Driver Flows.
  `tests/flow-drivers-report-jobs.test.cjs` checks all three are present (a Stop check per enqueue,
  no `opts.tempId` report, a `{ finished }` return), not where the check sits: put it last yourself.

## Not covered

Multi-angle's describe row (`describeImage({ queued: true })`) carries no id the frame knows: a
Stop during it lets that row finish, then nothing more queues. Its own queue-row Stop ends it.

Live check: [../05-verify.md](../05-verify.md) "One Stop stops the whole run".
