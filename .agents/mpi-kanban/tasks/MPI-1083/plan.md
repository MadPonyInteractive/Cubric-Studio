# MPI-1083 - Agent cancel cannot stop a Flow that enqueues late

## Goal

`cancel_generation` (MCP, `POST /connector/cancel`, Cosmo) stops a Flow run at ANY point:
during the describe step, during a cloud edit's pass 1 / cloud call, and on a chain's later
leg or a multi-pass Flow's next pass. Today it answers NOT_IN_FLIGHT for all of those.

## Root cause

`submitFlowGeneration` (js/services/flowService.js) returns a snapshot `{ queueJobId, tempId }`.
Whenever the job enters the Cue queue LATER than the call (describe, cloud edit, leg 2, pass 2)
that snapshot holds `null` or a finished leg's id, and `agentDispatch._submitFlow` stores it.

## Fix

1. flowService: `submitFlowGeneration` returns a live run HANDLE `{ tempId, queueJobId, cancelled, cancel() }`.
   Every enqueue (first, after describe, cloud pass 2, later legs, later passes) goes through one
   gate on that handle: cancelled -> `onCancel`, nothing enqueued; else record the queue id.
   Later legs/passes share the handle (`_leg.run`). `runCloudEdit` checks it before paying.
2. agentDispatch: `_queueJobs` keeps the handle; `_cancelGeneration` calls `handle.cancel()`.
3. MpiBaseFlow: the pane's Stop falls back to the handle when the run has no queue entry yet
   (same bug on the hand path: Stop during describe did nothing).
4. Tests in tests/agent-generation-relay.test.cjs: cancel during describe -> CANCELLED, never
   enqueued; cancel between legs -> leg 2 never enqueued; cancel while queued -> queue cancel.

## Verification

**Verify mode:** auto

- `node --test tests/agent-generation-relay.test.cjs tests/flow-chain.test.cjs tests/flow-cloud-edit.test.cjs`
- `npm test`

## Current State

2026-10-11: all four Fix items landed, npm test green (validation.md). Uncommitted. Next: close-out
(commit by pathspec from files.json, push, CI green, then done).

## Completed

- Fix 1-4. `cancelQueuedJob` now lives in flowService (one home; agentDispatch's model op uses it too).
  `_queueJobs` renamed `_inFlight` (it holds `{ cancel() }`, not ids).

## Remaining Work

Close-out only.

## Plan Drift

- 2026-10-11: three more source-pin tests needed the new shape: flow-chain, flow-describe, routine-runner.
