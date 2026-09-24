# MPI-901 plan

## Current State
All steps done 2026-09-24, tests green. Next: commit, push, close on a green CI run.

## Steps
1. Test `tests/remote-history-settle.test.cjs`: drive comfyController's `_reconcileFromHistory`
   and the runWorkflow listener against stubs; assert an error/interrupted history entry settles
   (reject) and that an `execution_interrupted` WS message clears the prompt's maps + poll.
   Prove it RED on current code.
2. Fix `_reconcileFromHistory`: settle on `status_str === 'error'` before the `completed` bail.
3. Fix the runWorkflow `internalListener`: treat `execution_interrupted` as terminal (reject,
   clear maps, stop poll, clear safety timer).
4. Test GREEN; run `npm test`.
5. Doc line in `docs/generation-lifecycle.md` § Per-gen identity doctrine.

## Verification
**Verify mode:** auto
`node --test tests/remote-history-settle.test.cjs` red before, green after; full `npm test` no new failures.

## Completed
Steps 1-5.

## Remaining Work
None.

## Plan Drift
- 2026-09-24: added `js/services/commandExecutor.js` — a reject on interrupt would reach its
  generic catch and open the bug-report dialog, so the interrupt resolves and commandExecutor's
  `onMessage` finishes on it like `execution_success`.
