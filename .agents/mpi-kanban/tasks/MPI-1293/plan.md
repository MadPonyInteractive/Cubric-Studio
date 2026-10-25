# MPI-1293 Plan

**Goal:** one press of a Flow window's Stop ends everything that window started: running jobs,
pending jobs, and any job a driver (Storyboard, Multi-angle) or a chain (legs, passes) would queue next.

## Root cause (verified 2026-10-25, corrects handoff 746a875c)
- `_cancel` stops ONE entry per press, and reads `activeGenerations.list()`, which holds only
  DISPATCHED jobs: a pending Cue job is never in it, so no press could reach one.
- A driver job that lands in an existing card's history (Multi-angle pass 2+) has NO tempId
  (`landingOpts`, routineDispatch.js), so the frame cannot match it at all: no latents (Fabio saw
  this live) and no Stop.
- Between a driver's jobs nothing is queued and the frame has no token: it reads idle, Stop is
  inert, and the next job still queues. Storyboard queues its panels one by one (await per
  buildGeneration) and has a cast -> panels gap; Multi-angle has describe + ref fetch between passes.

## Approach
1. generationService: `cancelCueJobs(predicate)` - pending first, then running (the order
   `cancelBatch` uses); `cancelBatch` goes through it.
2. MpiBaseFlow: `_isMine(entry)` (tempId of a graph run, queueJobId of a driver job) at every
   match site; `_cancel` flags every run handle, then `cancelCueJobs(_isMine)`; a driver run is ONE
   token from press to its last job, with a handle Stop flags.
3. Drivers: `onJob(queueJobId, done)`; `frame.stopped()` checked right before each enqueue;
   return `{ finished }` (or false when nothing started).
4. Tests: cancelCueJobs integration test; driver contract test (stopped check, finished).
5. Rule into add-flow playbook + mpi-add-flow SKILL.md; docs/generation-lifecycle.md if it states Stop.

Ownership: js/services/generationService.js, js/components/Blocks/MpiBaseFlow/MpiBaseFlow.js,
js/shell/storyboardDispatch.js, js/shell/multiAngleDispatch.js, tests/generation-batch-queue.test.cjs,
tests/flow-drivers-report-jobs.test.cjs, docs/playbooks/add-flow/**, .claude/skills/mpi-add-flow/SKILL.md

## Verification
**Verify mode:** user-ux
- `npm run lint`, `npm test` green.
- Live (Fabio's GPU): Storyboard and Multi-angle, one Stop ends the whole run; Multi-angle pass 2 shows latents.

## Completed
- All five approach steps (2026-10-25). Storyboard's driver edits landed in 06328dd08 (Storyboard 22
  applied them; the file was theirs). Rule page: docs/playbooks/add-flow/ui/stop-button.md.

## Remaining Work
- Fabio's live check (validation.md § Live). Then close.

## Current State
Code done and committed; card `validating`, waiting on Fabio's eyes. Gotcha: never test Stop from an
isolated app while Fabio's app runs (ComfyUI /interrupt has no owner). Known residual: Multi-angle's
describe row has no id the frame knows, so a Stop during it lets it finish; nothing queues after.

## Plan Drift
- 2026-10-25: handoff said Storyboard needed no change and Multi-angle was a graph Flow; both are
  drivers with between-job gaps. Multi-Angle 32 found the pass-2 no-tempId bug (no latents), folded in.
- docs/generation-lifecycle.md left alone: already over its 200-line budget, and the rule lives in the
  add-flow playbook.
