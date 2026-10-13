# MPI-1132 - Bench fakes every tool the loop calls

## Goal
`services/agentBench.mjs` `fakeTools` answers every `this._tools.X` that `services/agentLoop.mjs`
calls unguarded, the way the connector route answers, so a bench model gets the app's reply
instead of TOOL_ERROR "is not a function".

## Steps
1. Add fakes: listCards, visibleCards, markCard, makeGif, editGif, cutoutGif, gifToVideo, makeSheet,
   quoteGeneration, cancelGeneration, readGlobalMemory, writeGlobalMemory, openFlow, openPrompt,
   installFlow, discardAttachments.
2. Test in `tests/agent-bench.test.cjs`: every `this._tools.X` in agentLoop.mjs not called as `?.(`
   exists on fakeTools.

## Verification
**Verify mode:** auto
- `node --test tests/agent-bench.test.cjs` passes; the new test fails with a fake removed.

## Current State
Done; verified (validation.md).

## Completed
- Steps 1-2 (2026-10-13).

## Remaining Work
None.

## Plan Drift
