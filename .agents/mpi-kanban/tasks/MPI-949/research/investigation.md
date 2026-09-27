# MPI-949 investigation (2026-09-27, four read-only sub-agents)

Line numbers are as of master `7ac8f1d2a`. Verify a symbol still exists before trusting a line.
Block = `js/components/Blocks/MpiGroupHistoryBlock/MpiGroupHistoryBlock.js` unless named.

## 1. Card data + gallery surfaces

- `createItemGroup(type, overrides)` `js/data/projectModel.js:189-203` spreads overrides last, so
  `createdAt`, `kind`, `members`, `stackId` pass through. Typedef `:169-181`. `appendToHistory` `:221`
  (new object, selects last), `getSelectedItem` `:210`, `promoteHistoryEntry` `:233`.
- `addGroup`/`updateGroup`/`removeGroup` `js/services/projectService.js:478/491/545`, all inside
  `_enqueueMutation` `:467`, each a full `persistGroups()` `:591` → `POST /update-project`
  (`routes/projects.js:830`, `updateProjectJson`). `renameGroup`/`markGroup` `:509/:529` are the
  look-up-inside-the-queue precedent. Comment `:501-507`: never persist a stale captured group.
- **Persist whitelist `serializeGroup` `projectService.js:570-585`** - explicit field list; reused for
  closed-project writes (`generationService.js:755`, `agentDispatch.js:176`). New fields dropped unless listed.
- Read-back spreads unknown fields (`js/managers/projectReconciler.js:84`, `projectService.js:288`).
- **Reconciler drops any group whose hydrated history is empty** (`projectReconciler.js:79-82`) and
  `openProject` re-saves without it (`projectService.js:285-296`). `POST /project-groups`
  (`routes/projects.js:2610`) rejects empty history (`:2620`). `add-from-cards` builds groups field by
  field (`:2521-2533`).
- `{type: g.type}` fallbacks: grid predicate `MpiGalleryGrid.js:2124`, `projectEntries`
  (`galleryFilterPanel.js:53-56`), `_visibleCards` (`agentDispatch.js:1223`). `kindOfItem`
  (`js/utils/assetKinds.js:86`, catch-all `:74`) classes a stack as `image`. `listedKinds`
  (`galleryFilter.js:100`) would count hidden members.
- Order: `byGalleryOrder` (`galleryFilter.js:65-71`) is `createdAt` only; generating cards pinned first
  (`MpiGalleryGrid.js:2126-2130`). Array position in `setGroups` is irrelevant.
- **Hide members in `_inScope` / `matchesGallerySort` (`galleryFilter.js:51-62`)**, like `archived`
  (`:51`). Covers grid, filter panel, media picker, `gallery.visible`. NOT in the block's
  `_visibleProjectGroups` (`MpiGalleryBlock.js:180`) - `setGroups` calls at `:399/:448` bypass it and
  the grid needs member objects to paint the stack thumbnail.
- Card `_render` `MpiGalleryGrid.js:1333-1516`: no selected item → empty thumb `:1392`, no kind chip
  `:1499`. `_getAspectRatio` `:1994`. Render key `_getGroupRenderKey` `:2016-2052` (own history only).
  Card slots (`_makeCard` `:537-575`): `__kind`, `__top-badge`, `__order-badge`, `__stage2-badge`
  (`setStage2Count` `:1887`). `layers` icon `icons.js:55` (also used by Mask Comp and the MPI-948 set chip).
- Context menu `MpiGalleryGrid.js:1623-1697` (`{key, icon, label, disabled, info}` via
  `ui:context-menu`). Delete → block `grid.on('delete')` `MpiGalleryBlock.js:1197` → `_deleteDialog`
  (`MpiOkCancel` ok/alt/cancel `:1119`) → `_runGalleryDelete` `:1129-1174` (orphans a stack's members).
  Download `:1073` (null for a stack). Archive `_archive` `MpiGalleryGrid.js:429` mutates in place →
  `updateGroup` (`MpiGalleryBlock.js:521`). In-place mutation pattern (`_archive` `:430`, `onMark` `:422`,
  rename `:1599`) - do NOT copy it for stacks.
- Silent no-ops on a stack: reuse `:1512`, reveal `:1084`, add-to-project `:478`, compare `:336`, notes
  `:308`; Describe enabled (`:1654`, gated on `g.type==='video'` only); Make GIF (`:371`) lets a stack
  through as "image" and the block drops it (`:418`); Combine (`:387`) correctly excludes it.
- Opening: `open-group` `MpiGalleryBlock.js:289` → `PAGE_GROUP_HISTORY`. `resolveFlipTarget`
  `projectModel.js:320`. Media picker `_entries` `MpiMediaPicker.js:189-207` skips no-`filePath` groups.
- Selection bar: `selectionBar.js:36-47` actions, `:59-66` order, Cue all slot `:37/:61`.
  `_syncSelectionBar` `MpiGalleryGrid.js:364-403` passes `{disabled, info, label}`; `onAction`
  `:406-416` emits then `_exitSelectionMode`. `_selectedGroups` `:350` (click order).
  Precedent `grid.on('make-gif')` `MpiGalleryBlock.js:414-455`.
- MPI-948 drag: `_dragCards(group)` `MpiGalleryGrid.js:464-470` adds `cards:[{groupId,itemId,filePath,
  type,name}]` to `application/mpi-media`, set in both dragstarts (image `:1473-1486`, video
  `:1314-1325`). `cardReference` (`js/utils/mediaActions.js:66-86`) → `{set,name,count}` for 2+;
  agent drop `MpiAgentChat.js:1200-1208`.
- MCP/agent: `services/agentCards.mjs` `_groups` `:115` excludes archived only; `list_cards`
  (`routes/connector.js:1015`, `routes/mcp.js:342`) would list hidden members + a `versions:0` stack
  row (`:93-96`). MPI-950 territory.

## 2. PromptBox chip, dispatch, queue, results

- Drop: `MpiPromptBox.js:658-685` `_handleMediaDrop` reads `{filePath,type,name}` only; stack →
  "incompatible" toast today. `_tryAddMedia` `:513-568` builds `{id,url,file,mediaType,source,role?,
  name?}` (`:563`); op up-jump `:519-528`; eviction `:554-561`. `_withAssignedRoles` `:358-394`.
  `getRunPayload().mediaItems` `:2415/:691`. `_saveMedia` `:230-242` keeps `{url,mediaType,role,name}`
  (a stack chip would restore as one image); restore `:2717-2749` via `injectMedia` `:1294`.
- Chip is raw DOM in `_renderStrip` `:1001-1140` (only remove/role pills are MpiButtons). `_chipKey`
  `:1042` gates the repaint fast path `:1048`.
- Op gating: `_opChoices` `:1941-1962` (`disabled` + `info` → `data-info`, `MpiRadioGroup.js:59-64`);
  `_opBlockedReason` `:1923-1936`; counts `commandRegistry.js:1617-1655`. Also patch `_pickFallbackOp`
  `:1891` and `_opForMediaCount` `:505`. Loop hold-to-arm `:2510-2516`. Price tag `:2093` = one run.
- Expand in the Block: `MpiGalleryBlock.js:1526` `pb.on('run')` (holds `_galleryGenerationFromPayload`).
  Keep PromptBox / `getRunPayload` unaware of members (Loop, price, agent read that payload).
- Queue: `enqueueGeneration` `generationService.js:511-575` → flat `_cueQueue`; `_dispatchNextCue`
  `:386`; lanes cloud/remote/local, truth `generationStore.getSnapshot().running` `:102`. Loop
  `_onLaneDrain` `:341-375`. `MpiQueuePanel` (slide-over from `MpiGalleryBlock.js:103-114`) one row per
  job from `getGenerationQueueSnapshot` `:701`; row stop/cancel `MpiQueuePanel.js:383-384`.
  PromptBox Stop (`MpiGalleryBlock.js:1593-1627`) stops running only. `clearPendingQueue` `:1695`.
  **No parent/batch job exists.** `batchCount` = in-graph batch or cloud fan-out in one executor
  (`cloudExecutor.js:102-104, 341-344`); MPI-941 `_newBatch` (`services/agentLoop.mjs:1187`) is the
  agent's progress line only. Build: `opts.batchId`/`batchLabel` in `_buildQueueDisplay` `:208`,
  collapse in `getGenerationQueueSnapshot`, cancel-all = `removeCueJob(j => j.opts.batchId === id)`
  `:592` FIRST, then `cancelRunningCueJob`. `getGenerationQueueSnapshot` `:706`, orphan lookup in
  `cancelRunningCueJob` `:626-638`, idle check `:728` appear to ignore the cloud lane.
- Result cards: client-side `generationService.js:1597-1661` (`createItemGroup` + `appendToHistory`
  → `addGroup`); closed project → `_addGroupsToClosedProject` `:746` → `/project-groups`. Sidecar
  `saveGeneration` (`projectService.js:622`) at `generationService.js:1291`. Hook: new `opts.stackId`
  consumed at `:1608-1643` (existing `opts.deferCommit` `:1632` skips the closed-project path).
  History-scope completion `:1562-1596` re-reads the group by id → `appendToHistory` → `updateGroup`.
- Placeholders: `mkPlaceholder` `MpiGalleryBlock.js:1482-1500`; only the first running entry's
  (`_placeholdersForFirst` `:1649`, `_leadingGroups` `:1664`); removed by `_rebuildAfterEnd` `:1726-1742`.
- **`buildCueAllJobItems` sweeps the LAST staged chip of the type** (`commandRegistry.js:1912`): with
  stack chip 1 + reference chip 2, each member would replace the REFERENCE. Needs chip-id substitution.

### Cue-all inventory

| Where | Mark |
|---|---|
| `MpiGalleryBlock.js:37` import `buildCueAllJobItems` | keep |
| `MpiGalleryBlock.js:147-155` `getCueContext`; `:157-163` + `:1536-1591` `_cueAllDispatch`; `:1926-1938` `grid.on('cue-all')` | remove (move item shape `:1563-1570`, Loop refusal, no-`getNextGeneration` into the stack run) |
| `MpiGalleryGrid.js:14` import, `:344-361` `_cueTargets`/`CUE_INFO`, `:379-383, 408-412` action state + branch, comments `:119,126-128,154,1636` | remove / rewrite to Stack |
| `selectionBar.js:7,37,48,61` | rewrite to Stack |
| `commandRegistry.js:1863,1908` | keep; JSDoc `:1821-1853` rewrite |
| `tests/cue-all-eligibility.test.cjs` | keep; comments `:2-5,228` rewrite |
| `tests/desktop/gallery-cue-all.spec.js` | rewrite: keep bar order + `data-info` (`:163-176`, key `stack`), marks (`:178-189`), archive (`:250-261`), bar-shown/prompt-hidden; lane-busy stub `:204-212` + `peekCueQueue` reusable; drop `readCueButton` + steps 1-3 |
| `tests/desktop/delete-offers-archive.spec.js:76`, `radial-menu.spec.js:104` | comment / spec-name refs |
| `docs/gallery-selection.md`, `docs/gallery.md:281-283`, `docs/README.md:71` | rewrite |
| `docs/releases/UNRELEASED.md:162-164` (Cue all, never shipped) / `:167` | remove / rewrite |
| `.claude/rules/component-events-blocks.md:59,76,116`, `component-mounts.md:34,304`, `dos_and_donts.md:147` | rewrite - ASK Fabio first |
| `tests/agent-loop.test.cjs:2140`, `services/agentLoop.mjs:1174` | keep (history; MPI-941's files) |

## 3. History workspace

- Block is 3692 lines, one closure. Router mounts with `{groupId}` (`js/shell/navigation.js:546`);
  `_group` resolved once `:227`, guard `:276`; `historyKind` `:286-302`; **a stack (no history) throws
  at `:294`**. Slots: `#left-slot` tools `:466`; viewer table `VIEWER_MOUNTERS` `:471-481`;
  `#right-bottom-slot` `MpiHistoryList` `:947`; `#right-top-slot` `mountOptions` `:990-1108`
  (`TOOL_OPTIONS_REGISTRY` `:98`) → `_handleApply` `:1114-1181`; `#controls-mount` video bar `:517`,
  GIF strip wrappers `:540-635`; PromptBox `_mountPromptBoxIfNeeded` `:1855-1923`, `_shouldShowPromptBox` `:398`.
  `_group` used 112×, reassigned 13×, `_group.id` filtered 17×.
- **Stack = a MODE of this Block** via one `_switchMember(groupId)`; batch job-building in a pure
  sibling module.
- `MpiHistoryTools` (`js/components/Compounds/MpiHistoryTools/MpiHistoryTools.js`): `TOOL_LISTS` `:250`
  picked by `props.mode` `:259`; `setDisabled` only dims. Add `imageStack`/`videoStack` lists (GIF precedent).
- `MpiHistoryList` props `:6-10` (history, selectedIndex, isVideo, hasMaskForIndex, hasCopiedMask),
  emits indices. Select → `entry-selected` `:348` → Block `:2615-2639` (`promoteHistoryEntry` +
  `_persistGroup` `:431`). Delete menu `:221-300` → `delete-selected` → Block `:3152`; index 0 = whole-card
  cascade; `_performHistoryDelete` `:3051`; emptied group → `removeGroup` + `navigate(PAGE_GALLERY)`
  `:3090-3095`. Re-point without remount: `el.setGroups(history)` `:399` then `el.setActiveIndex` `:394`
  (set `_group` first).
- Apply paths - **all Comfy queue jobs except Crop**: imageUpscale `MpiToolOptionsUpscale.js:220` →
  `:1129-1151` → `_runImageTool` `:2242`; removeBackground `MpiToolOptionsRemoveBg.js:114` →
  `:1154-1161`; **resize `MpiToolOptionsResize.js:532` → `_handleResizeApply` `:2324` = Comfy
  `resize.json` (ImageResizeKJv2)**; resizeVideo + trim; videoUpscale / interpolate → `_runVideoTool`
  `:2209`; Prompt → `_runGenerate` `:2192` → `_generationFromPromptPayload` `:2142`. Workflows
  `js/data/modelConstants/universal_workflows.js:22-66`. All via `enqueueGeneration` with
  `{existingGroup, scope:'groupHistory', groupId}`. Helpers bound to the open group:
  `_group.history[_currentIdx]` (`:2145,:2210,:2243,:2326`), trim from viewer `:2128`, mask `:2182`.
  **Precedent for other groups: `agentDispatch._submitTool` (`js/shell/agentDispatch.js:652-687`) +
  `toolRun` (`js/shell/agentToolOps.js:90`) via `workspaceGenerationOpts` `:429`** - MPI-941 Phase 3 is
  building on these right now.
- `_syncQueueBlockedTools` `:489-512` disables Resize while any real Cue job is running/pending.
- Resize options: SDXL/FLUX presets, FREE, MP, SCALE (÷1.5/2/3/4) (`:47-82`); apply sends absolute W×H
  from the displayed source (`getSourceElement` `:565-582`). `deriveResizeDims` (`js/utils/ratios.js:838`)
  is pure - add `longEdge`/`percent`, compute per member.
- `MpiFrameStrip` (Organism, 689 lines) is GIF-specific - NOT reusable. New Compound `MpiMemberStrip`
  (`setMembers([{groupId, thumbUrl, name, dot}])`, `setSelected`; emits `member-select`,
  `pick-change`, `remove-member`, `delete-member`; right-click via `Events.emit('ui:context-menu')`
  like `MpiHistoryList:272`). Mount in `#controls-mount` in its own wrapper (`:545` precedent).
- Member switch: image `viewer.el.loadEntry(item, idx)` (`MpiCanvasViewer.js:1096`), video
  `viewer.el.loadVideo(url, meta)` (`MpiVideoViewer.js:307`), wrapped by `_reloadViewerWithEntry`
  `:1418`. Then `_setCurrentIdx`, `historyList.setGroups`, `_options?.el.setCurrentItem`.
- Event handlers assume one group: `:1368`, `:1448` (`_group = group` would jump to whichever member
  finished), `:1486`, `listFor(..., _group.id)` `:1290,:1295,:1925`. `MpiCanvasViewer` `_groupId` fixed at
  mount `:80` (mask temp store).

## 4. Crop

- Largest centred box already exists privately: `CropManager._applyRatioToRect()`
  (`js/components/Primitives/MpiCanvas/managers/CropManager.js:134-163`); from `init` `:80` on every
  `loadImage` (`MpiCanvas.js:415`), `setRatio` `:91`, `_enterMode('crop')` (`MpiCanvasViewer.js:977-980`).
  Inline size-only copy `agentToolOps.js:114-118`. Extract `largestCentredRect(w,h,ratio)` into
  `js/utils/cropSnap.js`.
- Rect lives only in `CropManager.cropRect` `:42`; reset by image load, ratio/orientation/family change,
  crop-mode re-entry. `project.toolSettings.crop` = panel values only (family, orientation, label,
  divisible_by, res_w, res_h, fill_color) - project-wide; `coerceSettings` `:69`.
- Apply: panel `apply {kind:'image', settings}` → Block `:1097` → `_handleApply` `:1117` →
  `viewer.el.runCrop` = `_runCrop` (`MpiCanvasViewer.js:1035`) → rounds w/h UP (`cropRounding.js:20`,
  x/y untouched) → `POST /project/crop-media` (`routes/projects.js:2672-2749`, file-path based,
  loop-callable) → `cropExtended` (`services/imageCrop.js:78`) → `crop-applied` → `_appendViewerEntry`
  (`:3186-3194`).
- Viewer API has no get/setCropRect (only `setCropRatio`/`setCropSize`/`runCrop` `:1378-1396`);
  `MpiCanvas` has them `:1585-1587`. Save/restore precedent: `MpiGifViewer` `:776-790`. No drag-end
  callback (`InputController.js:328`) - "moved" dot = compare to the seeded box.
- Video crop is separate (`js/utils/cropTool.js`, `MpiVideoViewer.js:382`, panel `kind:'video'`,
  `_handleCropSaveVideo` `:2415`, `routes/videoCrop.js:56`); GIF crop `/gif/crop`. `kind:'image'` only
  leaves both out.
- Traps: Divisible-by rounds UP → a Fill strip on edge-touching boxes and a skewed ratio;
  `pixelDimensions` unreliable (requested sizes, client-sent upload sizes, migrated `{0,0}`) → measure
  with `/image-import/probe` (`routes/imageImport.js:76`, EXIF-upright, batched); `cropExtended` reads raw
  metadata without auto-orient (`imageCrop.js:79`) while the canvas is upright - UNVERIFIED whether
  imports normalise orientation; key rects by the member's CURRENT item id; per-member saves must re-read
  the group from `state` and emit `media:updated` + `history:stats-dirty` like `_persistGroup`.
