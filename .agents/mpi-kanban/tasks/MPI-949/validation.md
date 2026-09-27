# MPI-949 Validation

Evidence per phase lands here. Verify mode: user-ux (Phases 2-5), auto (Phase 1, Batch A, Phase 6).

## Phase 1 - stack data foundation (auto) - PASSED 2026-09-27

- `node --test tests/stack-model.test.cjs tests/stack-reconcile.test.cjs tests/gallery-filter.test.cjs`
  → 29/29 pass.
- Mutation check: disabling the reconciler's `isStack(group)` exemption fails 2 reconcile tests
  (healthy stack round trip, member pruning); restored, green again.
- `npm test` → 2039 tests, 2038 pass, 0 fail, 0 cancelled.
- `npx eslint` on the six changed source files → clean.

## Batch A - building blocks (auto) - PASSED 2026-09-27

Four workers; every report re-checked against the files by the orchestrator (diff stat + re-run).
- A1 `node --test tests/generation-batch-queue.test.cjs` 8/8. Cloud-lane edits reviewed by hand against
  `cloudExecutor.cancel()` (post-send Stop keeps the paid result; unchanged).
- A3 `node --test tests/resize-dims.test.cjs` 15/15; `crop-resize-output.spec.js` 2/2.
- A4 `node --test tests/crop-centred-rect.test.cjs` 15/15; `crop-resize-output.spec.js` 2/2.
- A2 built `MpiMemberStrip` (its spec 1/1) - DROPPED on Fabio's call (duplicated the GIF strip); files,
  `preloadStyles.js` line and `types.js` block removed; `grep -rn MpiMemberStrip js tests` → 0.
- Integrated: `npm test` → 2079 tests, 2078 pass, 0 fail, 1 skipped. `npx eslint` on all 15 changed
  source files → clean. `npm run lint:components` → clean.
