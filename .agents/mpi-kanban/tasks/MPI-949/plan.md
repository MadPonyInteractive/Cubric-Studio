# MPI-949 Plan - Gallery stacks replace Cue all

## Current State

- **Project mode:** scalable-foundation. Full guardrails: ComponentFactory, BEM, state proxy,
  `updateProjectJson`, root-cause rule.
- **Design:** `brief.md` (settled with Fabio 2026-09-27). **Evidence:** `research/investigation.md`
  (four read-only sweeps with file:line refs - read the section for your phase before coding).
- **Facts that correct the brief** (this plan already follows them):
  1. **Resize is a Comfy job** (`resize.json`), not sharp. Only **Crop** is a direct server loop. So
     Resize joins Upscale/Remove BG/Interpolate/Prompt as a GPU batch.
  2. **No grouped queue entry exists.** "One entry, cancel-all" must be built (`opts.batchId`).
  3. **`buildCueAllJobItems` sweeps the LAST chip of the type**, so stack chip + reference chip would put
     each member in the reference slot. It needs substitution by chip id.
  4. **Grid order is `createdAt`.** A stack borrows its first member's `createdAt` to take that slot.
  5. **A history-less card is deleted on load** (reconciler) and rejected by `/project-groups`, and
     `serializeGroup` is a whitelist. Stacks need explicit support in all three.
  6. **`type:'stack'` breaks every `group.type` / `kindOfItem(selectedItem)` reader** (filters, Make
     GIF, drag payloads, `selectCueAllTargets`, History startup at Block `:294`).
  7. **Paid cloud price tag shows ONE run.** With a stack staged it must show the ×N total.
  8. The member strip and the GIF strip share ONE core, **`MpiThumbStrip`** (Phase 3b, Fabio's call);
     `MpiFrameStrip` composes it and keeps only the GIF layer.
  9. `pixelDimensions` is unreliable. Stack crop measures members with `/image-import/probe`.
- **Live peers:** MPI-941 (claim `5b8e4d8c-mpi941`) holds `js/shell/agentDispatch.js`,
  `js/shell/agentToolOps.js`, `services/agentLoop.mjs`, `routes/connector.js` - never edit through it.
  MPI-941 Phase 3 built `toolRun` (tool runs on any group, no model): Phase 4 REUSES it for stack Apply
  instead of growing a second copy. The grid claim it held is released (2026-09-27 ~10:03Z).

### Decisions (defaults taken, Fabio to confirm - see end of session message)

- **D1 Unstack order:** members return to their OWN `createdAt` slots (where they were before
  stacking). No new sort-key field. A result stack's members were made at Run time, so they land
  beside where the stack was anyway.
- **D2 Divisible-by in a stack rounds DOWN** (box stays inside the image), so no Fill strip and no
  ratio skew across N members. The single-card Crop keeps rounding up.
- **D3 Changing the ratio in a stack re-seeds EVERY member** to its centred box and clears the dots.
- **D4 A stack that drops to 1 member stays a stack.** It is deleted only at 0 members.
- **D5 Stacked cards are hidden from the Flow media picker too.** Unstack to pick one.
- **D6 Stack card icon = `layers`**, the same icon as the agent's "N cards" chip.
- **D7 Stack crop does not persist a family change**, so the single-card Crop keeps the user's
  free/resolution pick.

## Completed

- [x] **Phase 1: Stack data foundation** (2026-09-27). `js/data/stackModel.js` (pure: `isStack`,
  `stackableKind`, `stackCreateBlockReason` + `STACK_BLOCK_INFO`, `stackFields`, `applyStack`,
  `applyUnstack`, `applyRemoveMembers`, `applyAddMembers`, `sanitizeStacks`); `serializeGroup` writes
  `kind`/`members`/`expected` on stacks and `stackId` on members only (ordinary cards' on-disk shape
  unchanged); reconciler keeps history-less stacks and runs `sanitizeStacks` after hydration;
  `/project-groups` accepts a stack; `removeGroupFromProject` is stack-consistent; `projectService`
  `stackGroups(memberIds, opts)` / `unstackGroup(stackId)` (one persist each); `galleryFilter` hides
  `stackId` cards in every scope and reads a stack's kind from `stack.kind`. Tests:
  `tests/stack-model.test.cjs` (10), `tests/stack-reconcile.test.cjs` (6, fetch fully stubbed,
  mutation-checked), `tests/gallery-filter.test.cjs` (+1). `npm test` 2039/0 fail.
- [x] **Batch A - A3 Resize long edge / %** (2026-09-27). `deriveResizeDims(family, srcW, srcH,
  { longEdge, percent })` - families `'longEdge'` / `'percent'`, `Math.max(1, Math.round(src * k))` like
  scale/MP. `MpiToolOptionsResize` prop **`stackMode`** (documented in `types.js`): only LONG EDGE / %,
  preview suppressed, Apply emits `{ params: { rule: { kind: 'longEdge'|'percent', value }, upscale_method,
  keep_proportion, pad_color, crop_position, divisible_by, flip, rotation } }`; single-card payload
  unchanged. The Block resolves per member: `deriveResizeDims(rule.kind, w, h, { [rule.kind]: rule.value })`.
  `tests/resize-dims.test.cjs` 15/15; `crop-resize-output.spec.js` 2/2.
- [x] **Batch A - A4 Crop maths** (2026-09-27). `largestCentredRect(imgW, imgH, ratio)` in `cropSnap.js`
  (ratio = w/h number, null = full image) - `CropManager._applyRatioToRect` now delegates (one
  implementation, byte-identical). `roundDownToDivisible(v, n)` in `cropRounding.js` (largest multiple
  of n <= v, min n). `tests/crop-centred-rect.test.cjs` 15/15; `crop-resize-output.spec.js` 2/2.
  `js/shell/agentToolOps.js:114-118` (MPI-941's) has an inline size-only copy that could call it later.
- [x] **Batch A - A1 Grouped queue entry** (2026-09-27). `enqueueGeneration` opts `batchId`,
  `batchLabel`, `batchTotal`; pure `collapseQueueBatches(items)` in NEW `js/services/generationBatch.js`
  folds a batch into ONE snapshot row `{ isBatch, batchId, batchLabel, batchTotal, batchDone, status,
  queueJobId, canStop, canCancel, … }` (`getGenerationQueueSnapshot().items`; the raw `running`/`pending`
  counts stay raw); `cancelBatch(batchId)` exported (pending removed FIRST, then each lane's running
  member). `MpiQueuePanel` renders the batch row ("label · done / total", one **Cancel all**,
  `data-queue-action="cancel-batch"`; `--batch` modifier has no CSS of its own yet). **Also fixed three
  pre-existing cloud-lane gaps at the root** (MPI-851 made `cloud` a third lane but these read only
  remote/local): the snapshot's running rows, `cancelRunningCueJob`'s orphan + lane lookups, and
  `_emitPromptBoxGenerationEndIfIdle`. Reviewed against `cloudExecutor`'s cancel contract: a post-send
  Stop still keeps the paid result (the store cancels + drains; the identity-guarded drain only fires in
  the pre-register case, same as remote/local). `tests/generation-batch-queue.test.cjs` 8/8.
- [x] **Batch A - A2 dropped** (2026-09-27, Fabio): the standalone `MpiMemberStrip` it built was deleted
  (with its spec, its `preloadStyles.js` line and its `types.js` block) - it duplicated the GIF strip.
  Replaced by Phase 3b below.

- [x] **Phase 2: Stack card in the Gallery** (2026-09-27, session c94c87cb) - **VERIFIED by Fabio
  2026-09-27** after one fix: the delete dialog's alt label is **"Unstack"** (was "Unstack and keep",
  which pushed Cancel out of the 440px dialog). Selection bar **Stack** replaces Cue all (reason from
  `stackCreateBlockReason`); grid resolves a stack's face through ONE pair `_faceOf` / `_shownItem`
  (+ `_shownType`) so every thumb/aspect/kind/hover/drag reader shows the first member with no per-site
  branch; stack look = `--stack` class (two offset edges via `::before/::after`, face inset by `--s-2`),
  always-on `__stack-badge` (layers + count), model/op badge, sub-line, notes and reuse hidden. Card
  menu **Unstack** (only when a stack is picked); Describe / Card notes disabled on a stack. Block:
  `grid.on('stack')` → `stackGroups` (named after the first card), `unstack` → `unstackGroup` + repaint;
  Delete with a stack in the pick → `_stackDeleteDialog` (Cancel / Unstack and keep / Delete all);
  Download, Reveal, Add to project and Delete all act on members via new pure
  `expandStacks(picked, groups)` in `stackModel.js`. Drag: `_dragPayload(group)` builds both dragstarts;
  a stack sends `type:'stack', stackId, kind, count` + members as `cards`. Opening a stack = `ui:info`
  until Phase 4. `el.refreshGroup(member)` also refreshes its stack card. All Cue-all grid/bar/block code
  removed (`selectCueAllTargets`, `buildCueAllJobItems` + their unit test kept).
  Tests: `tests/desktop/gallery-stack.spec.js` (replaces `gallery-cue-all.spec.js`) green 5/6 - the one
  red was a concurrent Playwright run wiping `test-results/desktop` (see Drift); `stack-model` +1 test;
  `npm test` 2111/0 fail; `lint:components` clean; 30/30 gallery regression specs green.

- [x] **Phase 3b: shared `MpiThumbStrip`** (2026-09-27, background worker, integrated) - **VERIFIED by
  Fabio 2026-09-27** ("everything else checked and working"). New Compound
  `js/components/Compounds/MpiThumbStrip/` (359 + 73 lines); `MpiFrameStrip.js` 689 → 491 lines, API and
  events unchanged. **Phase 4 API:** props `items [{key, thumbUrl, info?}]`, `currentIndex`,
  `allowReorder`, `menuItems(index, selected) → items|null`, `decorateThumb(thumbEl, index)`; methods
  `setItems(items, {currentIndex})` (clears selection, fires `selection-change`), `setCurrentIndex`,
  `setSelection`, `getSelection`, `repaintThumbs`, `destroy`; events `thumb-select {index}`,
  `selection-change {indices}`, `scrub {index}`, `scrub-end {index}` (switch the stack viewer on THIS),
  `reorder {from,to}`, `menu-select {key, index, selection}`. Integration fix: MpiFrameStrip pushed
  `strip.on(...)` results (undefined - a component `on()` returns no unsubscribe) into `_unsubs`, where
  destroy's try/catch swallowed the TypeError; unwrapped, `strip.destroy()` drops them.

- [x] **Phase 3: Gallery run → new stack** (2026-09-27, session 00cc0995) - **VERIFIED by Fabio
  2026-09-27**: real 3-card Klein 9B Edit filled "i2i_001 · Edit" 3/3; Cancel all tested, fine; the blank
  0/3 card and the face showing the last result that landed are fine as they are. (One result swapped
  image 1/2 - the sidecars prove all three jobs loaded member→inputImage, reference→inputImage2; it was
  the model on that seed, not the run.) PromptBox stack chip (`_handleMediaDrop`
  `type:'stack'`, gallery box only; one per box; `_saveMedia`/restore keep `stackId`/`count`; layers badge
  `__stack`; op gating via `_stackBlockedReason` = `selectCueAllTargets` in `_opChoices`,
  `_pickFallbackOp`, `_opForMediaCount`, plus a move-off after a stack lands on a blocked op; Loop refuses
  via `_refuseLoopForStack` on hold and hotkey; price tag `×N` + `formatPrice(usd*N)`).
  `buildCueAllJobItems(..., { chipId })` substitutes by chip id. Block `_runStack`: Loop refusal, live
  members via `expandStacks` (kind-checked), op guard, jobs FIRST with `batchId`/`batchLabel` (op label)/
  `batchTotal`/`stackId`, no `getNextGeneration`, then `addGroup(result stack)` with `expected` = queued.
  Completion: `addGroupsToStack(groups, stackId)` (one mutation) or, closed project, cards carry
  `stackId` and `/project-groups` appends them to the stack's members server-side. Settle: generationService
  `_settleResultStacks` → `settleResultStack(id)` (clear `expected`, or remove a 0-member stack) when no job
  of the run is live; status line names how many did not finish. Grid badge `k/N` while filling.

- [x] **Phase 4: Stack History workspace** (2026-09-27, session 47374da7) - **VERIFIED by Fabio
  2026-09-27** (validation.md § Phase 4). Opening a stack = `navigate(PAGE_GROUP_HISTORY,
  { groupId: stackId })`; the Block resolves `_stackId` and sets `_group` to the first live member.
  **Member contract:** `_group` is always the member on screen; only `_showMember(member)` moves it
  (clears the old member's gen ids, re-keys the canvas mask store via `loadEntry(item, idx, { groupId })`,
  `historyList.setGroups` + `setActiveIndex`, `setCurrentItem`, adopts the new member's running jobs).
  `_syncStack()` follows `project:group-updated|removed` for the stack or any strip member (repaint, move
  off a member that left, Gallery at 0). Strip = `MpiThumbStrip` in its own host in `#controls-mount`
  (a video stack adds a second host for the video bar); menu Remove from stack (`removeFromStack`) /
  Delete card (confirm; a card goes only when all its files went). ◀ Version ▶ = `stepStackVersions`
  (pure `applyStepVersions`). Rail `imageStack` / `videoStack` (Prompt, Resize, Upscale + Remove BG /
  Interpolate). Apply: `_runImageTool` / `_runVideoTool` / `_handleResizeApply` branch to
  `_runStackTool` -> pure `stackToolJobs` (NEW `js/data/stackJobs.js`) -> `_enqueueBatch` (one batchId,
  no getNextGeneration). Resize sizes: `/image-import/probe` (images), `<video>` metadata (videos).
  Prompt: `_runStackPrompt` = pinned chip substituted per member via `buildCueAllJobItems(..., { chipId })`,
  `_generationFromPromptPayload(payload, member)`, mask dropped, Loop refused. Header = whole-stack
  stats (`stackStatsGroup`). PromptBox `setRunCount(n)` makes a paid model's tag quote xN.

- [x] **Phase 5: Stack crop** (2026-09-28, session c72df5c7) - **VERIFIED by Fabio 2026-09-28**
  (validation.md § Phase 5). Rail: `crop` in `IMAGE_STACK_TOOLS`' Transform group (video stacks
  still none; an image stack with no prompt now opens on Crop). Panel `stackMode`: family forced RATIO,
  family row hidden, never persisted (D7); `settings.ratio`; `ratio-change {ratio}` on a user pick only.
  Viewer: `getCropRect` / `setCropRect`, and `cropItem(item, rect, {fill,outW,outH})` - the ONE
  `/project/crop-media` call, `_runCrop` goes through it too. Block: `_cropRects` (Map item id -> MOVED
  box only) + `_cropSeed`; `_saveStackCrop` on member switch (`_showMember`), tool switch (`mountOptions`)
  and Apply; `_restoreStackCrop` on `entry-loaded` and crop-panel mount; ratio change clears the Map (D3);
  strip dot = `decorateThumb` -> `mpi-group-history-block__member--crop-moved`. Apply = `_runStackCrop`:
  probe sizes -> pure `stackCropRects` (stackJobs.js) -> sequential `cropItem` -> fresh group ->
  `appendToHistory` -> `await updateGroup`; StatusBar progress; the member on screen re-shown.

- [x] **Phase 6 docs** (2026-09-28, session c83e035c). NEW `docs/stacks.md` (184 lines), routed from
  `docs/README.md`; `docs/gallery-selection.md` Cue-all section -> Stack + "which ops a stack can run";
  `docs/gallery.md` pointer; stale Cue-all comments (`commandRegistry.js` JSDoc, three test comments).
  `UNRELEASED.md` NOT edited: peer a447ff60 holds it and its rewrite already swaps Cue all for Stack;
  message `77e907be` asks it to also name what an opened stack does.

## Remaining Work

**None - card closed 2026-09-28** (89d7b92ba, CI green). Rules maps refreshed with Fabio's OK. Open follow-ups
live on other cards: MPI-950 (agent `list_cards` stack awareness), MPI-959 (EXIF crop).

## Phase 1: Stack data foundation (auto) - DONE, see Completed

Everything else reads this. Sequential; no UI.

- [ ] Pure module `js/data/stackModel.js`: `isStack`, `stackKind`, `createStackGroup(members,
  {name, createdAt})` (kind from members, `createdAt` borrowed from the first-clicked member),
  `unstack(stack, groups)` (clears `stackId`, copies `archived` onto members), `resolveMembers`,
  `sanitizeStacks(groups)` (prune missing member ids, clear orphan `stackId`s, drop empty stacks),
  `stackCreateBlockReason(groups)` (mixed kinds / contains a stack / audio or GIF / fewer than 2).
  `kind` comes from each member's selected item through `kindOfItem`.
  Ownership: `js/data/stackModel.js`, `tests/stack-model.test.cjs`.
  **Verify:** `node --test tests/stack-model.test.cjs` green, with a case for every block reason and
  every sanitize branch.
- [ ] Persistence: add `kind`, `members`, `stackId` (plus result-stack `expected` total) to
  `createItemGroup` typedef (`projectModel.js:169-203`) and `serializeGroup` (`projectService.js:570`).
  Exempt stacks from the reconciler's empty-history drop (`projectReconciler.js:79-82`) and run
  `sanitizeStacks` there. Accept stacks in `POST /project-groups` (`routes/projects.js:2620`).
  **Verify:** unit test: a stack survives serialize → reconcile → serialize byte-identical, and a
  stack with a deleted member is pruned while a stack with 0 members is dropped.
- [ ] `projectService` single-persist mutations `stackGroups(memberIds, opts)` and
  `unstackGroup(stackId)`, and a stack-aware `removeGroup` path (delete-all-N vs unstack-and-keep).
  N+1 group changes, ONE `persistGroups`, inside `_enqueueMutation`, re-reading groups from `state`.
  **Verify:** unit test on the mutation (stubbed persist): one write per call, and members'
  `stackId` is set and then cleared.
- [ ] Gallery scope: `_inScope` / `matchesGallerySort` (`js/utils/galleryFilter.js:51-62`) hide any
  group with `stackId`. A stack's kind for filtering is `stack.kind`, never `kindOfItem(undefined)`.
  `listedKinds` skips members.
  **Verify:** extend `tests/gallery-filter.test.cjs`: members hidden, a video
  stack filtered as video, and the kind counts exclude members.

## Parallel Batch A: independent building blocks (auto)

Runs after Phase 1, while MPI-941 still holds the grid. Disjoint files, and each task is checkable
alone. Use `mpi-execute-parallel`.

- [x] **A1 Grouped queue entry.** `opts.batchId` / `batchLabel` through `_buildQueueDisplay`
  (`generationService.js:208`); `getGenerationQueueSnapshot` collapses one batch into one row ("Upscale
  3/10"); `cancelBatch(batchId)` = `removeCueJob(j => j.opts.batchId === id)` FIRST, then
  `cancelRunningCueJob`. Check the cloud-lane gaps at `:706`, `:626-638`, `:728`. If they are real,
  fix them at the root in the same pass. The `MpiQueuePanel` row renders the batch and its cancel.
  Ownership: `js/services/generationService.js`, `js/components/Compounds/MpiQueuePanel/*`,
  `tests/generation-batch-queue.test.cjs`. Briefings: components, state, root-cause.
  **Verify:** unit test: 3 enqueued jobs sharing a batchId → one snapshot row with count 3;
  `cancelBatch` leaves 0 pending and cancels the running one; unbatched jobs unchanged.
- [x] ~~**A2 `MpiMemberStrip` Compound.**~~ DROPPED - see Phase 3b. New Compound (Primitives-only imports): `setMembers([{groupId,
  thumbUrl, name, dot}])`, `setSelected(id)`, ctrl/shift pick; emits `member-select`,
  `pick-change`, `remove-member`, `delete-member`; right-click via `Events.emit('ui:context-menu')`;
  `destroy()` unbinds. Register `.css` in `js/shell/preloadStyles.js`, props in `js/components/types.js`.
  Ask Fabio about the dev components gallery.
  Ownership: `js/components/Compounds/MpiMemberStrip/*`, `js/shell/preloadStyles.js`,
  `js/components/types.js`, `tests/desktop/member-strip.spec.js`. Briefings: components, dos_and_donts.
  **Verify:** `npm run lint:components` clean; a desktop spec mounts it through `ComponentFactory`
  and asserts select / pick-change / context-menu events and a clean destroy.
- [x] **A3 Resize long-edge and %.** `deriveResizeDims` (`js/utils/ratios.js:838`) gains `longEdge`
  and `percent`. `MpiToolOptionsResize` gains those two families, stack-only (a prop). Apply carries
  the rule, not absolute W×H, when in stack mode.
  Ownership: `js/utils/ratios.js`, `js/components/Organisms/MpiToolOptionsResize/*`,
  `tests/resize-dims.test.cjs`. Briefings: components.
  **Verify:** unit test: long edge 1024 on 4000×3000 → 1024×768 and on 1080×1920 → 576×1024; 50% →
  half. The existing resize families are unchanged (the single-card spec still passes).
- [x] **A4 Crop maths.** `largestCentredRect(w, h, ratio)` in `js/utils/cropSnap.js`;
  `CropManager._applyRatioToRect` delegates to it (one implementation). A round-DOWN variant of
  divisible rounding in `js/utils/cropRounding.js` for stacks (D2).
  Ownership: `js/utils/cropSnap.js`, `js/utils/cropRounding.js`,
  `js/components/Primitives/MpiCanvas/managers/CropManager.js`, `tests/crop-centred-rect.test.cjs`.
  **Verify:** unit tests for both helpers; the existing crop desktop spec still passes.

## Phase 2: Stack card in the Gallery (user-ux) - DONE, verified by Fabio (see Completed)

- [ ] Selection bar: **Stack** replaces Cue all (`selectionBar.js`, `_syncSelectionBar`). Disabled +
  `info` from `stackCreateBlockReason`; emits `stack` with groups in click order. The block handler
  calls `stackGroups`. Remove every Cue-all grid/bar/block part per the inventory
  (`research/investigation.md` § Cue-all inventory); keep `selectCueAllTargets`,
  `buildCueAllJobItems` and their unit test.
- [ ] Card: thumbnail, aspect and kind chip from the first member's selected item; `layers` badge +
  count; offset card edges (CSS, tokens only). Render key includes each member's selected item id.
  A member's `project:group-updated` repaints its stack.
- [ ] Right-click on a stack: **Unstack**; **Delete** → `_deleteDialog` stack branch ("Unstack and
  keep" / "Delete all N"); Download = all members; Archive. Every `group.type` / `kindOfItem` reader
  on the gallery path is made stack-aware at its root, not guarded per site: Make GIF, Describe,
  reuse, compare, notes, reveal, add-to-project, flipper. Opening a stack stays inert until Phase 4.
- [ ] Drag: a stack's dragstart carries its members as `cards` (the agent gets today's "N cards" set,
  with no agent-side change) plus `{type:'stack', stackId, kind, filePath: first member}` for the
  PromptBox.
  Ownership: `MpiGalleryGrid.js`, `selectionBar.js`, `MpiGalleryGrid.css`, `MpiGalleryBlock.js`,
  `tests/desktop/gallery-stack.spec.js` (replaces `gallery-cue-all.spec.js`, keeping its marks /
  archive / bar-order checks).
  **Verify:** desktop spec on `app:isolated`: stack 3 cards → one card with badge 3, members hidden,
  survives a project reload; mixed image+video → Stack disabled with a reason; right-click Unstack →
  3 cards back; Delete → both dialog branches; drag onto the agent composer → one "3 cards" chip.
  **Fabio checks the look.**

## Phase 3: Gallery run → new stack (user-ux)

- [ ] PromptBox stack chip: `_handleMediaDrop` / `_tryAddMedia` accept `{stackId, count,
  mediaType: kind, url: first member}`; `_saveMedia` + restore keep `stackId`/`count`; `layers` badge +
  count in `_renderStrip`, with stack-ness in `_chipKey`; one stack chip per box. Op gating: a staged
  stack disables any op where `selectCueAllTargets(op, model, [{type: kind}])` is not eligible, with a
  plain `info` reason; `_pickFallbackOp` / `_opForMediaCount` never land on a blocked op. Loop cannot
  be armed or run with a stack. The price tag shows ×N and the total.
- [ ] `buildCueAllJobItems(operation, model, staged, card, {chipId})`: substitute the member INTO the
  stack chip's slot. The default behaviour is unchanged for existing callers.
- [ ] Block run (`MpiGalleryBlock.js` `pb.on('run')`): a stack chip → create the result stack
  ("<source> · <op>", `expected: N`, `createdAt` now) → N `enqueueGeneration` with `opts.batchId` +
  `opts.stackId`, and no `getNextGeneration`.
- [ ] `generationService` completion: `opts.stackId` stamps `stackId` and appends to the stack's
  `members` in the same mutation (open AND closed-project paths). Member placeholders are
  suppressed; the stack card shows "4/10" until done. Cancel or failure keeps what finished, and the
  status line names how many are missing. A result stack with 0 members is removed.
  Ownership: `js/components/Organisms/MpiPromptBox/*`, `js/data/commandRegistry.js`,
  `MpiGalleryBlock.js`, `js/services/generationService.js`, `tests/cue-all-eligibility.test.cjs`,
  `tests/desktop/gallery-stack-run.spec.js`.
  **Verify:** unit: chip-id substitution keeps a reference chip in place on a 2-chip Klein Edit. Desktop
  spec with the lane-busy stub (from the old Cue-all spec): a stack of 3 + Klein Edit → 3 pending jobs,
  each with the member in slot 1 and the reference in slot 2; ONE queue row; cancel-all → 0 pending;
  Text-to-image is disabled with the reason. **Fabio runs a real 3-card Klein Edit and sees a new
  stack fill.**

## Phase 3b: Shared thumbnail strip - `MpiThumbStrip` (user-ux: Fabio feels the GIF strip)

Fabio 2026-09-27: no duplicated strip code. The GIF strip (`MpiFrameStrip`, Organism, 689 lines) and the
stack's member strip share ONE core; the stack uses the GIF film-strip UX (current member under a fixed
centre marker, drag scrubs), approved.

- [ ] New Compound **`js/components/Compounds/MpiThumbStrip/`** (imports Primitives only) extracted from
  `MpiFrameStrip`'s generic half: windowed rendering (`VIEW_RADIUS`, `_ensureWindow`/`_renderWindow`),
  fixed centre marker + `translateX` (`_applyTransform`, ResizeObserver with the 0x0 bail), pointer
  grammar (click → select, drag past `DRAG_THRESHOLD` → scrub, Ctrl toggle / Shift range with the anchor
  subtlety, optional press-and-hold reorder behind a prop), the right-click → caller-supplied items. A
  Compound cannot import `MpiContextMenu` (same tier), so it goes through `Events.emit('ui:context-menu')`
  (the shell hop that exists for same-tier callers); `MpiFrameStrip` (an Organism) may keep calling
  `MpiContextMenu.show()` by supplying items through a prop callback instead. Per-thumb decoration
  (range classes, mask tint, edited, lifted, stack dot) through a `decorateThumb(thumbEl, index)` prop +
  a cheap class-flip pass (the `_paintRange` idiom). Items are `{ key, thumbUrl, info? }`.
- [ ] **`MpiFrameStrip` keeps its name, its instance API and every event byte-for-byte** (setFrames,
  setCurrentIndex, setRange, getStagedFrames, getSelection, setMaskOverlay, commit; frame-select,
  selection-change, clear-frame-mask, scrub, stage-change, update, apply) and composes `MpiThumbStrip`,
  keeping only the GIF layer: staged/committed/origin/viewerPos bookkeeping, the Discard/Update/Apply
  pill, duplicate/delete, mask overlay, trim range, `gif.frame.delete*` hotkeys. **The GIF Block is not
  touched.**
- [ ] Stack use (wired in Phase 4): `MpiThumbStrip` directly, items = members' current versions (video →
  poster), menu = Remove from stack / Delete, `decorateThumb` paints the moved-crop dot, selection = the
  Apply picks. Scrub switches the viewer only on scrub END (a 350-member scrub must not load every member).
  Ownership: `js/components/Compounds/MpiThumbStrip/*` (new), `js/components/Organisms/MpiFrameStrip/*`,
  `js/shell/preloadStyles.js`, `js/components/types.js`, `tests/desktop/thumb-strip.spec.js` (new).
  Ask Fabio about the dev components gallery.
  **Verify:** `npm run lint:components` clean; new desktop spec mounts `MpiThumbStrip` alone (select,
  scrub, ctrl/shift, menu items via the event hop, destroy); EVERY GIF desktop spec green (`ls
  tests/desktop | grep -i gif` - frame strip reorder / delete / duplicate / mask / range / hotkeys);
  `MpiFrameStrip.js` shrinks to the GIF layer. **Fabio: open a GIF, scrub, reorder, Ctrl-select +
  Backspace, right-click duplicate - must feel identical.**

## Phase 4: Stack History workspace (user-ux)

- [ ] Block stack mode: resolve a stack → its first member BEFORE `historyKind` (`:294`); a single
  `_switchMember(groupId)` re-points `_group`, `_setCurrentIdx`, `MpiHistoryList` (`setGroups` then
  `setActiveIndex`), the viewer (`_reloadViewerWithEntry`) and the options panel. The canvas viewer
  gets a `groupId` setter (mask store). Event listeners filter by the member-id set and NEVER jump the
  workspace to whichever member finished.
- [ ] `MpiHistoryTools` `imageStack` / `videoStack` lists (hidden tools absent). `MpiThumbStrip` (Phase 3b)
  goes in `#controls-mount` (own wrapper). The **◀ Version ▶** stepper (MpiButtons) moves every
  member's `selectedIndex` by one, clamped, in one persist.
- [ ] Batch Apply: a pure builder (`js/data/stackJobs.js`) maps (member group, current item, tool
  params) → a job spec, reusing MPI-941's `toolRun` / `workspaceGenerationOpts` path for
  upscale / remove-BG / resize and the History generation path for prompt / video tools. Targets =
  picked members, or all. One `batchId` and one queue row. Video trim comes from `item.trim`. Resize
  uses the A3 rule per member. Prompt runs substitute each member into the pinned chip (chip-id
  `buildCueAllJobItems`), drop the viewer mask, and refuse under Loop. `_syncQueueBlockedTools` must
  not lock the rail mid-batch in a way that strands the user (decide from the code, keep the
  single-card behaviour).
- [ ] Member lifecycle: strip right-click Remove from stack / Delete; deleting a member's last
  version removes it from the stack and STAYS in the workspace; a stack at 0 members is deleted and
  the view goes back to the Gallery.
  Ownership: Block, `js/components/Compounds/MpiHistoryTools/MpiHistoryTools.js`,
  `js/components/Organisms/MpiCanvasViewer/MpiCanvasViewer.js`, `js/data/stackJobs.js`,
  `tests/stack-jobs.test.cjs`, `tests/desktop/stack-history.spec.js`. Opening a stack from the Gallery
  (inert since Phase 2) is wired here.
  **Verify:** unit: the stackJobs builder for each tool, and picked subset → k specs. Desktop spec:
  open a stack of 3, click member 2 → its history shows; ◀ → all three `selectedIndex` drop by one
  (persisted); Upscale with the lane-busy stub → 3 pending jobs, 1 row; pick 2 → 2 jobs; Paint/Mask
  absent. **Fabio runs a real Upscale on a stack.**

## Phase 5: Stack crop (user-ux)

- [ ] Crop panel stack mode: ratio type only, Divisible-by round-down (D2), Fill Outside kept, and no
  family persistence (D7). Member dims come from `/image-import/probe` (batched, on entering crop). A
  Block-side `Map<itemId, rect>` is seeded with `largestCentredRect`. The viewer gains
  `getCropRect` / `setCropRect`, saved on member switch and restored on `entry-loaded` (the
  MpiGifViewer precedent). Dot = rect differs from the seeded one. A ratio change re-seeds all members
  (D3).
- [ ] Apply loops `POST /project/crop-media` per target member (picked or all) with a progress line.
  Each result goes through a fresh group read from `state` → `appendToHistory` → `updateGroup` and
  emits `media:updated` + `history:stats-dirty`.
- [ ] Check the EXIF trap: does import normalise orientation? If `cropExtended` really crops
  orientation ≥5 photos in the wrong place, file a SEPARATE card (it is a pre-existing single-card bug)
  and tell Fabio. Do not patch it inside the stack loop.
  Ownership: Block, `js/components/Organisms/MpiToolOptionsCrop/*`, `MpiCanvasViewer.js`,
  `tests/desktop/stack-crop.spec.js`.
  **Verify:** desktop spec: 3 members of different sizes, 9:16, move the box on one → Apply → 3 new
  versions, each probed at 9:16 within divisible rounding and fully inside the source, the moved one
  offset. **Fabio stacks real photos and crops 9:16.**

## Phase 6: Docs, rules, close-out (auto)

- [ ] `docs/stacks.md` (new, ≤200 lines, routed from `docs/README.md`); rewrite
  `docs/gallery-selection.md` (Cue all out, Stack in) and `docs/gallery.md:281-283`;
  `docs/releases/UNRELEASED.md` drops the never-shipped Cue all note and adds Stacks; stale comments
  from the inventory.
- [ ] `.claude/rules/` (`component-events-blocks.md`, `component-mounts.md`, `dos_and_donts.md`):
  **ASK Fabio before editing** (CLAUDE.md rule 5). `component-events-blocks.md` is also in MPI-941's
  claim.
  **Verify:** `npm test` green; `npm run lint` + `npm run lint:components` clean; the gallery / history /
  crop / stack desktop specs green; `grep -rn "cue-all\|_cueAllDispatch\|getCueContext" js/` returns
  nothing.

## Execution notes

- Order: Phase 1 → Batch A (`mpi-execute-parallel`) → Phase 2 (after MPI-941 frees the grid) →
  3 → 4 → 5 → 6. Phases 2-5 stay sequential: they share `MpiGalleryBlock.js`, the Block and
  `generationService.js`.
- If MPI-941 still holds the grid after Batch A, Phase 4's Block + strip work can go first, since it
  does not touch `MpiGalleryGrid.js`. Test it by opening a stack built by the Phase 1 unit fixtures.

## Plan Drift

- 2026-09-28 (Phase 5): **the box is saved on LEAVE, not on drag** (no drag-end callback): member switch,
  tool switch, Apply. Only MOVED boxes are stored; everything else is recomputed from the probe at Apply,
  so a 350-member stack never loads its members to crop them. Switching versions inside one member's
  history list drops that member's moved box (keyed by item id) - accepted.
- 2026-09-28 (Phase 5): a rounded-down box shrinks about its CENTRE (not from the right/bottom as the
  single-card round-up grows), so every box stays inside its picture.
- 2026-09-28 (Phase 5): Apply is NOT a queue batch - `/project/crop-media` is a direct sharp call, looped
  sequentially with a StatusBar progress fill; no Cancel all. Ownership grew: `js/components/types.js`,
  `MpiGroupHistoryBlock.css` (dot), `js/data/stackJobs.js` + its test (`stackCropRects`).
- 2026-09-28 (Phase 5): **EXIF crop bug confirmed, pre-existing, not patched** - `cropExtended` ignores
  orientation (validation.md § Phase 5). Root fix is in `services/imageCrop.js` (auto-orient before the
  plan). Filed as **MPI-959** (Fabio, 2026-09-28), with `imageComposite.js` (Paint/Place flatten) as a
  suspected second site.

- 2026-09-27 (Phase 4): **`toolRun` is NOT reused.** It maps the AGENT's fields (`upscaler`, `factor`)
  to params; the rail's panels already build params in `_handleApply`. Stack Apply keeps the rail's
  param building and fans it out per member (`stackToolJobs`), so a rail click and a stack Apply are one
  graph with one param source.
- 2026-09-27 (Phase 4): ownership grew: `stackModel.js` (`applyStepVersions`, `stackStatsGroup`),
  `projectService.js` (`removeFromStack`, `stepStackVersions`), `js/shell/navigation.js` (accent from
  `stack.kind`; no stats refresh for a stack - the Block reports it), `MpiGalleryBlock.js` (open),
  `MpiPromptBox.js` (`setRunCount`), `MpiGroupHistoryBlock.css`, `tests/mask-tool-registry.test.cjs`
  (source guard regex).
- 2026-09-27 (Phase 4): **Crop is NOT on the stack rail** until Phase 5 - the single-card crop would
  crop only the member on screen. Stack mode opens on Prompt, else Resize.
- 2026-09-27 (Phase 4): `_syncQueueBlockedTools` does nothing in stack mode - its lock exists for the
  single-card Resize PREVIEW job (MPI-253), and stack Resize has no preview.
- 2026-09-27 (Phase 4): the stack init (`_paintStrip`, listeners) runs AFTER `_mountPromptBoxIfNeeded`:
  `_paintStrip` -> `_syncRunCount` reads `_pb`, whose `let` sits later in setup (TDZ killed the mount).
- 2026-09-27 (Phase 4): `navigation.js` filters header stats to the ROUTE's group id, so a member's own
  `history:stats-dirty` is ignored in a stack; the Block emits `stackStatsGroup` (every member version
  under the stack id) on each file-set change.

- 2026-09-27 (Phase 1): **every removal is stack-consistent at the one primitive**,
  `removeGroupFromProject` (all four `removeGroup` callers): removing a STACK unstacks its members,
  removing a MEMBER prunes it, the last member takes the stack with it. So Phase 2's "Unstack and keep"
  is plain `removeGroup(stack)`, and "Delete all N" = the existing gallery delete over the MEMBER cards
  (files + cards); the stack disappears with the last one. No separate stack-delete mutation.
- 2026-09-27: `sanitizeStacks` keeps a 0-member stack only while `expected > 0`. **Phase 3 must clear
  `expected` when its batch settles AND on app start** (the cue queue does not survive a restart), or an
  empty "0/N" result stack lingers.
- 2026-09-27: `stackGroups` emits `project:group-added` (the gallery repaints from it). `unstackGroup`
  emits `project:group-removed`, which the gallery does NOT listen to, so the Phase 2 handler repaints
  (`setGroups`) after awaiting it.
- 2026-09-27: the scope hide is in `matchesGallerySort`, so `agentDispatch._visibleCards` (MPI-941's
  file, untouched) also stops listing stacked members as "visible". Intended: the agent sees what the
  user sees. `list_cards` still lists them (MPI-950).
- 2026-09-27: `stackCreateBlockReason` also refuses 3D Scenes (`unsupported-kind`), not only GIF/audio.
- 2026-09-27 (Phase 2): **the Cue-all dispatch loop is DELETED from `MpiGalleryBlock.js`** (and its
  `buildCueAllJobItems` import, now unused). Phase 3's stack run rebuilds from
  `git show 36e7fc24c:js/components/Blocks/MpiGalleryBlock/MpiGalleryBlock.js` (`_cueAllDispatch`): the
  chip item shape, the Loop refusal, and NO `getNextGeneration` on a batch job.
- 2026-09-27 (Phase 2): `MpiOkCancel`'s action row does not wrap or shrink: three buttons whose labels
  outgrow `min(440px, 90vw)` push Cancel off the LEFT edge (Fabio's screenshot). Fixed here by the
  shorter "Unstack" label; the component itself still clips any long 3-button set (not this card).
- 2026-09-27 (Phase 2): the stack-delete dialog says **"Delete all"**, not "Delete all N" - `MpiOkCancel`
  has no label setter and destroying one inside its own emit breaks its `hide()`. A new stack is named
  after its FIRST card (whose slot and face it takes); the badge says it is a stack.
- 2026-09-27 (Phase 2): both card dragstarts now share `_dragPayload`, so a video drag also carries
  `name` and an image drag also carries `thumbPath` (the agent chip shows the 512 thumb, not the master).
- 2026-09-27 (Phase 2): a stack's `media-missing` names its FACE member (whose file it is), so the
  Block prunes the member, never the stack.
- 2026-09-27: **two sessions/workers running Playwright at once share `test-results/desktop`** - one
  run's startup `rmdir`s the other's `testInfo.outputPath` project folder mid-test (`ENOTEMPTY`, or a
  spec red for no reason). Run desktop specs from ONE agent at a time.
- 2026-09-27 (Phase 3): **a result stack settles from queue liveness, not per-job callbacks.** A job is
  live while in `_cueQueue`, on a lane (`_lanes[x].active`), or in the registry - the registry entry ends
  only AFTER `addGroupsToStack`, so the last result cannot be beaten by its own settle. The check is
  coalesced to the next task and runs on `generation-queue:changed`, `generation:complete|error|cancelled`
  and `project:changed` (that last one is the "on app start" clear: a fresh queue has no job for it).
  The Block enqueues the jobs BEFORE `addGroup(result)` so the settle never sees a filling stack with no job.
- 2026-09-27 (Phase 3): the closed-project path appends members in the ROUTE (`/project-groups`), inside
  `updateProjectJson`: the renderer's copy of the stack is frozen at dispatch, so N results posting it
  back would erase each other. Ownership grew accordingly: `stackModel.js` (`resultStackFields`,
  `applySettleResultStack`), `projectService.js` (`addGroupsToStack`, `settleResultStack`),
  `routes/projects.js`, `MpiGalleryGrid.js` (`k/N` badge + render key), `tests/flow-defer-commit.test.cjs`
  (a source-shape guard on the deferCommit gate, now also naming `addGroupsToStack`).
- 2026-09-27 (Phase 3): **member placeholders are NOT suppressed** (plan said suppress). The first running
  job shows the ordinary "Generating..." card with live latents, its input preview = the member being
  edited, and the result goes inside the stack when it lands. Zero extra code; Fabio to confirm.
- 2026-09-27 (Phase 3): kleinEdit's label is "Edit", so a result stack reads "<source> · Edit" and the
  queue row "Edit · k / N". The chip's `count` is a snapshot at drop; the run reads the stack's live members.
- Known edge (Phase 3): a Stopped PAID cloud job whose result still arrives after the settle joins the
  stack if the stack kept any member; if it had none, the settle removed it and the card lands loose.
- The mutation wrappers were NOT split into separate pure `applyStack` callers as the brief suggested:
  `projectService` imports cleanly in bare Node, so `serializeGroup` is unit-tested directly.

## Verification

**Verify mode:** user-ux

Phase 1, Batch A and Phase 6 are `auto`. Phases 2, 3, 4 and 5 are `user-ux`: stop after each for
Fabio to look at it in the running app.

End to end: in a real project, Fabio stacks 10 photos → drops the stack + one reference into the box
→ Klein Edit → a new stack of 10 fills under one queue row; opens it → ◀ Version, fixes two members
by hand, re-runs Upscale on 3 picked members; crops the stack to 9:16; unstacks → every card is back
with its new versions. `npm test`, lint and the stack desktop specs green; CI green on the closing
commit.

## Preservation Notes

- New durable knowledge → `docs/stacks.md` (the reconciler exemption, the `createdAt` borrow, the
  batchId queue model, chip-id substitution, the member-switch contract).
- Rules maps need Fabio's permission (CLAUDE.md rule 5).
- Hand MPI-950: `services/agentCards.mjs` `_groups` lists hidden members + a `versions:0` stack row;
  `list_cards` / `readCard` need stack awareness.
- Pre-existing bug candidates found here (separate cards, not this one): cloud-lane gaps in
  `getGenerationQueueSnapshot` / `cancelRunningCueJob` (if A1 shows they are not already handled), and
  crop EXIF orientation (Phase 5 check).
