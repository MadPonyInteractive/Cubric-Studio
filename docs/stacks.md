# Gallery stacks (MPI-949)

A stack is ONE gallery card holding N image cards or N video cards. Drop it on the Gallery prompt
box to run one op per member (the results fill a NEW stack); open it for the batch-safe History
tools (each result is a new version of its member). It replaced Cue all, which never shipped.
Selection and the selection bar: [gallery-selection.md](gallery-selection.md). Verify a named
symbol still exists before relying on an entry.

## Data model

`js/data/stackModel.js` is the pure half (no projectModel import: `galleryFilter` reads `isStack`).
A stack is an ordinary ItemGroup with `type: 'stack'`, `kind: 'image'|'video'`, `members: [groupId]`
in click order, and an **empty `history`**: it owns no media. Each member keeps its own history and
sidecars untouched and carries `stackId`.

- **`members` is the truth; `stackId` is a back-pointer** the gallery filter reads.
  `sanitizeStacks(groups)` repairs every disagreement: a missing or doubly-owned member is pruned, an
  orphan `stackId` cleared, and a stack with no members dropped unless `expected > 0` (a run is still
  filling it).
- **A stack takes its first member's slot.** The grid orders by `createdAt`, so `stackFields` borrows
  the FIRST member's `createdAt` (and its `archived`). Unstack puts every member back at its OWN
  `createdAt` (D1); there is no sort-key field.
- **Kind comes from the selected ITEM** (`stackableKind` → `kindOfItem`), never `group.type`: a video
  group can hold an image item. `stackCreateBlockReason` returns `too-few` / `contains-stack` /
  `unsupported-kind` (GIF, audio, 3D Scene) / `mixed-kinds`; `STACK_BLOCK_INFO` is the status-bar text.
- **A stack at 1 member stays a stack** (D4). It goes only at 0.
- `serializeGroup` is a whitelist: it writes `kind` / `members` / `expected` on stacks and `stackId` on
  members only, so an ordinary card's on-disk shape is unchanged.

## Persistence traps

- **The reconciler deletes a history-less card on load.** `projectReconciler.js` exempts `isStack`
  from that drop, then runs `sanitizeStacks` after hydration (a member whose media vanished must leave
  its stack, or the gallery hides cards behind a stack that is not there).
- **`POST /project-groups` rejects an empty history**, so it accepts a stack by shape (empty history +
  a `members` array). Closed-project run results arrive carrying `stackId` and join that stack's
  `members` INSIDE the route's `updateProjectJson`: the renderer's copy of the stack is frozen at
  dispatch, so N results posting it back would erase each other.
- **Every removal goes through ONE primitive**, `removeGroupFromProject` (all four `removeGroup`
  callers): removing a STACK unstacks its members, removing a MEMBER prunes it, and the last member
  takes the stack with it. "Unstack" is plain `removeGroup(stack)`; "Delete all" is the ordinary
  gallery delete over the member cards.
- `projectService` mutations persist ONCE each, inside `_enqueueMutation`, re-reading from `state`:
  `stackGroups`, `unstackGroup`, `removeFromStack`, `stepStackVersions`, `addGroupsToStack`,
  `settleResultStack`. `stackGroups` emits `project:group-added`; `unstackGroup` emits
  `project:group-removed`, which the gallery does NOT listen to, so its handler repaints itself.

## In the Gallery

- **Scope:** `matchesGallerySort` (`js/utils/galleryFilter.js`) hides any card with a `stackId` in
  every scope, and filters a stack by `stack.kind`. So `agentDispatch._visibleCards` also stops
  listing members: the agent sees what the user sees. Stacked cards are hidden from the Flow media
  picker too (D5).
- **Face:** the grid resolves a stack through ONE pair, `_faceOf` / `_shownItem` (+ `_shownType`), so
  every thumb / aspect / kind / hover / drag reader shows the first member with no per-site branch.
  Look = `--stack` (two offset edges via `::before/::after`) + an always-on `__stack-badge` (`layers`
  icon, D6, + count); model badge, notes and reuse hidden. A member's `media-missing` names the FACE
  member, so the Block prunes the member, never the stack. `el.refreshGroup(member)` refreshes its stack.
- **Selection bar Stack** took Cue all's slot; disabled with the `stackCreateBlockReason` text. A new
  stack is named after its first card. Card menu **Unstack** appears only with a stack picked;
  Describe and Card notes are disabled on one.
- **Delete with a stack in the pick** opens `_stackDeleteDialog`: Cancel / **Unstack** / Delete all.
  The label is "Unstack", not "Unstack and keep": `MpiOkCancel`'s action row neither wraps nor
  shrinks, and a longer set pushed Cancel off the 440px dialog.
- Download, Reveal, Add to project and Delete all act on members via `expandStacks(picked, groups)`.
- **Drag:** both dragstarts share `_dragPayload`. A stack sends `type: 'stack', stackId, kind, count`
  for the PromptBox plus its members as `cards`, so the agent composer gets its existing "N cards" chip
  with no agent-side change.

## Gallery run → a new stack

- **Stack chip** (`MpiPromptBox._tryAddMedia` with `stackId`; Gallery box only, one per box):
  `_saveMedia` / restore keep `stackId` / `count`; `_chipKey` includes stack-ness. `count` is a
  snapshot at drop: the run reads the stack's LIVE members.
- **Op gating:** a staged stack blocks any op where `selectCueAllTargets(op, model, [{type: kind}])`
  has a reason (eligible = exactly ONE required media slot of that kind). `_stackBlockedReason` gates
  `_opChoices`, `_pickFallbackOp` and `_opForMediaCount`, and a stack landing on a blocked op moves
  off it. Loop refuses while a stack is staged (`_refuseLoopForStack`). A paid model's tag shows ×N
  and `formatPrice(usd * N)`.
- **Chip-id substitution:** `buildCueAllJobItems(op, model, staged, card, { chipId })` puts each member
  IN the stack chip's slot. Without `chipId` it sweeps the LAST chip of the type, which on
  stack + reference would put every member in the reference slot. Ordinal-slot ops (`kleinEdit`,
  `krea2Edit`, `qwenEdit`, `control`) depend on this; a sidecar check must read the swept slot, not
  `mediaItems[0]`.
- **`_runStack` in `MpiGalleryBlock.js`:** refuses under `state.loopArmed` (`_onLaneDrain` re-fires the
  last job, so a batch would never end), reads the recipe once, enqueues one job per live member with
  `batchId` / `batchLabel` / `batchTotal` / `stackId` and **no `getNextGeneration`**, THEN
  `addGroup(result stack)` with `expected` = jobs queued. Jobs first: the settle drops a filling stack
  with no live job. The result is named "<source> · <op label>" and dated now (top of the grid).
- **Completion:** a result with `opts.stackId` joins the stack in the same mutation
  (`addGroupsToStack`), or through the route when the project is closed. Member placeholders are NOT
  suppressed: the ordinary "Generating..." card shows live latents and the result goes inside the
  stack when it lands. The grid badge reads `k/N` while filling.
- **Settle from queue liveness, not per-job callbacks** (`_settleResultStacks` in
  `generationService.js`). A job is live while pending, on a lane, or in the registry, and the
  registry entry ends only AFTER `addGroupsToStack`, so the last result cannot lose to its own
  settle. Coalesced to the next task, on `generation-queue:changed`, `generation:complete|error|cancelled`
  and `project:changed` (the restart case: the queue does not survive one). Settle clears `expected`,
  or removes a 0-member stack, and the status line names how many did not finish.
- Known edge: a Stopped PAID cloud job whose result still arrives after the settle joins the stack if
  it kept any member; if none, the stack is gone and the card lands loose.

## The batch queue row

`enqueueGeneration` opts `batchId`, `batchLabel`, `batchTotal`. The pure `collapseQueueBatches(items)`
(`js/services/generationBatch.js`) folds a batch into ONE snapshot row (`isBatch`, `batchDone`, ...);
the raw `running` / `pending` counts stay raw. `MpiQueuePanel` renders "label · done / total" with one
**Cancel all** (`data-queue-action="cancel-batch"`). `cancelBatch(batchId)` removes the PENDING jobs
FIRST (a lane drain cannot promote a removed job), then stops each lane's running member across all
THREE lanes (`cloud` too: MPI-851 made it a third lane and several readers only knew remote/local).

## Stack History workspace

Opening a stack = `navigate(PAGE_GROUP_HISTORY, { groupId: stackId })`. It is a MODE of
`MpiGroupHistoryBlock`, not a new Block: `_stackId` is the route's stack, `_group` the member on screen.

- **Member contract: `_group` is always the member on screen, and only `_showMember(member)` moves it.**
  It saves the outgoing crop box, clears the old member's gen ids, re-keys the canvas mask store via
  `_reloadViewerWithEntry(item, { groupId })`, re-points `MpiHistoryList` (`setGroups` then
  `setActiveIndex`), `setCurrentItem`, and adopts the new member's running jobs. Listeners never jump
  the workspace to whichever member finished.
- `_syncStack()` follows `project:group-updated|removed` for the stack or any member: repaint, move off
  a member that left, back to the Gallery at 0 members.
- **Strip** = `MpiThumbStrip` (the Compound the GIF strip also composes) in its own host in
  `#controls-mount`; the viewer switches on scrub END, so a 350-member scrub loads one member. Menu:
  Remove from stack / Delete card. `decorateThumb` paints the moved-crop dot. Picks = Apply targets
  (`stackTargets`: picks, or all).
- **◀ Version ▶** = `stepStackVersions` (pure `applyStepVersions`): every member's `selectedIndex`
  by one, clamped, one persist.
- **Rail:** `MpiHistoryTools` modes `imageStack` (Prompt, Crop + Resize, Upscale + Remove BG) and
  `videoStack` (Prompt, Resize, Upscale + Interpolate). No Paint, Mask or Place: they are drawn on one
  picture. An image stack with no prompt opens on Crop.
- **Apply** of a queue tool: `_runImageTool` / `_runVideoTool` / `_handleResizeApply` branch to
  `_runStackTool` → pure `stackToolJobs` (`js/data/stackJobs.js`) → `_enqueueBatch` (one `batchId`,
  no `getNextGeneration`). The rail's panels build the params and the stack fans them out per member,
  so a single-card Apply and a stack Apply are one graph with one param source. (MPI-941's agent
  `toolRun` is NOT reused: it maps the agent's fields, not the panel's.)
- **Resize in a stack** offers only LONG EDGE / % (`MpiToolOptionsResize` prop `stackMode`) and sends
  a RULE, not W×H; each member resolves it with `deriveResizeDims(rule.kind, w, h, ...)`. Sizes come
  from `/image-import/probe` (images) or `<video>` metadata: `pixelDimensions` is unreliable.
- **Prompt runs** (`_runStackPrompt`): the pinned chip is substituted per member (chip-id
  `buildCueAllJobItems`), the viewer mask is dropped, Loop refuses. `PromptBox.setRunCount(n)` makes
  a paid tag quote ×n.
- **Header** stats: `navigation.js` filters stats to the ROUTE's id, so the Block emits
  `stackStatsGroup` (every member version under the stack id) whenever the file set changes.
- `_syncQueueBlockedTools` does nothing in stack mode: its lock exists for the single-card Resize
  PREVIEW job (MPI-253), and stack Resize has no preview.
- Setup order trap: the stack init (`_paintStrip`, listeners) runs AFTER `_mountPromptBoxIfNeeded`;
  `_paintStrip` → `_syncRunCount` reads `_pb`, whose `let` sits later in setup (a TDZ killed the mount).

## Stack crop

One ratio for every member, one box per member. `MpiToolOptionsCrop` `stackMode`: family forced to
RATIO, family row hidden, never persisted (D7, so the single-card Crop keeps the user's pick);
`ratio-change` fires on a user pick only and clears every saved box (D3).

- **The box is saved on LEAVE, not on drag** (there is no drag-end callback): `_saveStackCrop` on
  member switch, tool switch (`mountOptions`) and Apply; `_restoreStackCrop` on `entry-loaded`.
- **Only MOVED boxes are stored** (`_cropRects`, keyed by the member's current ITEM id, compared with
  the canvas's seed `_cropSeed`). Everything else is recomputed at Apply by the pure
  `stackCropRects` from probed sizes, so a 350-member stack is never loaded to be cropped. Switching
  versions inside one member drops that member's moved box (accepted).
- **Divisible-by rounds DOWN in a stack** (D2), shrinking about the box's CENTRE, so every box stays
  inside its picture and there is no Fill strip or ratio skew. The single-card Crop still rounds up.
- **Apply (`_runStackCrop`) is NOT a queue batch.** `/project/crop-media` is a direct sharp call, so
  it loops `viewer.el.cropItem(item, rect, opts)` sequentially (the ONE crop call; `_runCrop` uses it
  too) with a StatusBar progress fill, re-reading each member from `state` before `appendToHistory`
  → `updateGroup`. No Cancel all.
- EXIF-rotated photos crop in the wrong place: that is `cropExtended` ignoring orientation, a
  pre-existing single-card bug filed as MPI-959, not a stack bug.

## Not done here

- Agent listing: `services/agentCards.mjs` `_groups` lists hidden members plus a `versions: 0` stack
  row; `list_cards` / `readCard` need stack awareness (MPI-950).
- `MpiOkCancel` still clips any three-button set whose labels outgrow the dialog.

## Tests

Unit: `stack-model`, `stack-reconcile`, `stack-jobs`, `project-groups-stack`, `generation-batch-queue`,
`resize-dims`, `crop-centred-rect`, `cue-all-eligibility` (chip-id substitution), `gallery-filter`.
Desktop: `gallery-stack`, `gallery-stack-run`, `stack-history`, `stack-crop`, `thumb-strip`. Run
desktop specs from ONE agent at a time: two Playwright runs share `test-results/desktop` and one's
startup wipes the other's project folders mid-test.
