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

## Phase 3 - Gallery run into a new stack (user-ux) - VERIFIED by Fabio 2026-09-27

- Unit: `cue-all-eligibility` +1 (chip-id substitution on a 2-chip Klein Edit keeps the reference in
  slot 2; without the id the old last-chip rule sweeps the reference), `stack-model` +1
  (`resultStackFields`, `applySettleResultStack` both ways), NEW `project-groups-stack` 2/2 (two closed-
  project results each join the stack, re-post not listed twice, a card whose stack is gone still lands),
  `flow-defer-commit` updated (source guard also names `addGroupsToStack`) -> 52/52 + 14/14 in the
  targeted runs.
- `npm test` -> 2157 tests, 2154 pass, 1 fail: `agent-denoise` read a PEER's in-flight
  `services/agentLoop.mjs` (MPI-941) mid-edit; the file passes 7/7 alone. The earlier `agent-loop`
  "short list" red is the same peer's uncommitted work.
- eslint on every touched file + `npm run lint:components` -> clean.
- NEW `tests/desktop/gallery-stack-run.spec.js` 1/1 (with `gallery-stack.spec.js` 1/1): stack of 3 ->
  drop -> ONE chip, badge 3, text op dim with its reason; a second drop replaces the chip; reference in
  slot 2 + kleinEdit; Run with both lanes busy -> 3 pending jobs, member b/c/a in slot 1 in stack order,
  reference in slot 2, one batchId, no getNextGeneration, ONE queue row {isBatch, total 3, label Edit};
  result stack "<source> · Edit" persisted with expected 3, badge 0/3; one result via
  `addGroupsToStack` -> 1/3, card hidden in the stack; cancelBatch -> 0 pending, settles to members [1],
  badge 1; a second run cancelled before anything lands -> the empty result stack is removed; Ctrl+L with a
  stack staged -> not armed, refusal toast shown; 0 page errors.
- Regression, 9 specs (prompt-box-badge, prompt-box-peek, media-picker-to-history, agent-drag-set,
  cancel-targets-own-prompt, gallery-generating-mascot, gallery-archive, gallery-filter-panel,
  flow-queue-hotkey) -> 18/18 passed.
- NOT covered by a spec (Fabio's check): a real engine run filling the stack, the paid-cloud price tag
  `×N`, the stack chip surviving a Gallery -> History -> Gallery round trip, closed-project fill live.

- Fabio, 2026-09-27, in his app (project `test`): stack of 3 + a reference + Klein 9B Edit -> one queue
  row "Edit · 0 / 3", result stack "i2i_001 · Edit" filled 3/3 and settled (`expected` gone, 3 members on
  disk). Cancel all tested: "all good". Blank 0/3 card and the face tracking the last landed result: fine.
  One result restyled the reference instead of image 1; its sidecar load list is member
  `imageUpscale_002.png` -> inputImage, reference `t2i_002.png` -> inputImage2, identical to the other two
  (seeds differ) - a model misread, not the run.

## Phase 4 - Stack History workspace (user-ux) - VERIFIED by Fabio 2026-09-27

- Unit: NEW `tests/stack-jobs.test.cjs` 6/6 (targets = picks or all, file-less members dropped; upscale ->
  one job per member on its CURRENT version with the member as `existingGroup`; a picked subset gives
  exactly its jobs; resize rule -> 1024x768 / 576x1024 per member, a member with no size skipped, % ->
  half; video saved trim rides along, a whole-clip trim does not; plugin inputs reach every job).
  `stack-model` +2 (`applyStepVersions` clamps per member and never touches a card outside the stack;
  `stackStatsGroup`). `mask-tool-registry` source guard widened for `loadEntry(item, idx, { groupId })`.
- `npm test` -> 2174 tests, 2172 pass, 0 fail. `npm run lint:components` + eslint on every touched file
  -> clean.
- NEW `tests/desktop/stack-history.spec.js` 2/2: real project, 3 cards x 2 versions stacked -> click the
  stack in the Gallery opens History with a 3-thumb strip, member 1 on screen, rail = prompt / transform /
  enhance only (Mask, Paint, Composite absent); click member 3 -> its history list, route still names the
  stack; ◀ -> all three `selectedIndex` 0 on disk, ◀ again clamps, ▶ -> all 1; Upscale with both lanes
  busy -> 3 pending jobs, member order, each on its v2 file, `groupHistory` + own `existingGroup`, one
  batchId, ONE queue row {isBatch, 3, "Upscale"}; Ctrl-pick 1 and 3 -> 2 jobs, one row of 2; strip
  right-click Remove from stack -> stack members [1, 3], card 2 loses `stackId`, strip shows 2; 0 page
  errors. Video stack (in-memory): `#controls-mount` holds strip host then video-bar host, video viewer,
  stack rail, shell accent `video`; leaving empties `#controls-mount`.
- Regression, 7 specs (crop-resize-output, gallery-stack-run, gallery-stack, history-modes,
  history-prompt-model, media-picker-to-history, thumb-strip) -> 12/12 passed.
- NOT covered by a spec (Fabio's check): a real Upscale / Remove BG / Resize on a stack landing as new
  versions; a Prompt run on a stack; Delete card from the strip; deleting a member's last version; the
  paid-cloud price tag quoting xN in a stack; a video stack with real clips.
- Fabio, 2026-09-27: checked in the app -> "1" (verified).

## Phase 5 - Stack crop (user-ux) - VERIFIED by Fabio 2026-09-28

- Unit: `tests/stack-jobs.test.cjs` +1 -> 7/7 (`stackCropRects`: a dragged box keyed by the member's
  CURRENT item id is kept and one keyed by an old version ignored; the rest get the largest centred 9:16
  box on their probed size; w/h round DOWN to 16 about the centre -> every rect inside its picture; a
  member with no size and no box is skipped).
- NEW `tests/desktop/stack-crop.spec.js` 1/1, real files + the real `/project/crop-media`: stack of 400x300
  / 300x400 / 256x256 ramps -> Crop on the stack rail, family row hidden (RATIO only); 9:16 -> member 1
  box = its centred 116,0 169x300; box moved to 20,0 -> member 2 shows ITS centred box, strip thumb 1
  carries `--crop-moved`, back to member 1 -> the moved box is restored; Apply -> each member +1 `crop`
  version, selected; files measured 160x288 / 224x400 / 144x256 (all 9:16 within rounding); member 1 cut
  from x 24 (ramp red < 30, centred would be ~76), square cut centred (red ~55); dot gone; project.json
  lists 2 versions each; 0 page errors. **Mutation-checked:** with `_restoreStackCrop()` disabled the spec
  fails at "the moved box is back".
- `npm test` -> 2178 tests, 2176 pass, 0 fail. eslint on every touched file + `npm run lint:components`
  -> clean.
- Regression, 8 specs (crop-resize-output, gallery-stack-run, gallery-stack, history-modes,
  history-prompt-model, media-picker-to-history, stack-crop, stack-history) -> 14/14 passed.
- **EXIF check (plan item):** `cropExtended` (`services/imageCrop.js:78`) crops the RAW pixel grid while the
  canvas and `/image-import/probe` are upright. Reproduced in Node: a 40x20 JPEG with orientation 6, upright
  crop 0,0 20x10 -> output differs from `sharp(src).rotate().extract(same)` by up to 223 per channel. Imports
  under the reduce limit are copied untouched (EXIF kept), so a phone photo shot portrait crops the wrong
  region in single-card Crop AND stack crop. Pre-existing; NOT patched here - filed as MPI-959.
- NOT covered by a spec (Fabio's check): the box feel with real photos, a ratio change re-seeding every
  member (D3), Ctrl-picked members only, a 16K member.
- Fabio, 2026-09-28: checked in the app -> "1" (verified); asked for the EXIF card (MPI-959).
