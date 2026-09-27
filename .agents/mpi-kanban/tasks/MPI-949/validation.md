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

## Phase 2 - stack card in the Gallery (user-ux) - VERIFIED by Fabio 2026-09-27

- `npx playwright test --config=playwright.desktop.config.js tests/desktop/gallery-stack.spec.js` → green
  5 of 6 runs (1 + `--repeat-each=3` + 1). It covers: mixed image+video → Stack disabled with
  "A stack holds images or videos, not both"; bar order + every action's `data-info`; bar marks persisted;
  Stack in click order b,c,a → one card, badge 3, `project.json` stack `members` [b,c,a] + each member's
  `stackId`; stack dragstart → `type:'stack'`, 3 `cards`, `cardReference` → "3 cards"; `openProject`
  reload keeps the stack (sidecar-less fixture dropped, stack + members kept); menu Unstack → 3 cards,
  no stack/`stackId` on disk; Delete → dialog [Cancel, Unstack and keep, Delete all]; Unstack and keep
  deletes no file; Delete all removes both cards, both files and the stack; bar Archive persisted.
  The one red run overlapped the Phase 3b worker's own Playwright run: both clean `test-results/desktop`
  (reproduced: `ENOTEMPTY: directory not empty, rmdir 'test-results\desktop'`). Re-run once the worker
  is done - see below.
- Regression, 10 gallery specs (agent-drag-set, delete-offers-archive, gallery-archive,
  gallery-filter-panel, gallery-renditions, gif-make, radial-menu, media-picker-cards, gallery-gif-hover,
  gallery-media-release) → 30/30 passed.
- `node --test tests/stack-model.test.cjs` 11/11 (+ `expandStacks`). `npm test` → 2112 tests, 2111 pass,
  0 fail. `npx eslint` on the grid folder, the gallery Block and `stackModel.js` → clean;
  `npm run lint:components` → clean. `grep -rn "cue-all\|_cueAllDispatch\|getCueContext" js/` → only a
  history note in `selectionBar.js`'s header.
- Screenshot of the stack card in the isolated app: face = first-clicked member, layers badge "3" top-left,
  two offset edges top-right, image kind chip bottom-right.
- After the worker finished (no concurrent runner): `gallery-stack.spec.js --repeat-each=3` → 3/3, and
  green again inside the 25-spec run below. The earlier red was the shared-`test-results` collision.

## Phase 3b - shared MpiThumbStrip (user-ux) - VERIFIED by Fabio 2026-09-27

- Worker report re-checked on disk: `git status` shows the new `MpiThumbStrip/` folder + spec and the
  four modified files it claimed; `wc -l MpiFrameStrip.js` → 491 (HEAD 689).
- Orchestrator re-run, sequential: `thumb-strip.spec.js` + `gif-workspace`, `gif-maker`, `gif-make`,
  `gif-timing`, `gif-transform`, `gif-cutout`, `gallery-gif-hover` + `gallery-stack` → **25/25 passed**
  (worker baseline before its change: GIF set 23/23).
- `npm run lint:components` → clean (after the `_unsubs` integration fix).
- `npm test` at the end: 2112 tests, 2089 pass, **22 fail - all in `smoke-evidence-merge`,
  `smoke-free-space`, `smoke-gpu-fallback`, `smoke-orphan-guard`**, driven by a peer's uncommitted
  `scripts/smoke-workflows.mjs` edit. None touch this card's files; the same suite was 0-fail two hours
  earlier in this session.

## Fabio, 2026-09-27

- Checked Phase 2 and 3b in his app: "Everything else checked and working". One defect, fixed: the
  stack-delete dialog clipped Cancel off its left edge with "Unstack and keep"; label is now "Unstack".
  `gallery-stack.spec.js` updated to [Cancel, Unstack, Delete all] → 1/1 passed; eslint clean.
