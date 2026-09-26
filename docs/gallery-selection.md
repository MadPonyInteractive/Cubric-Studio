# Gallery selection — multi-select and Cue all

Split out of [gallery.md](gallery.md) when that file reached the 200-line cap (MPI-733). Card
rendering, media playback and drag-drop stay there. Verify a named symbol still exists before
relying on an entry.

## Selection survives setGroups refresh (2026-07-12)

`MpiGalleryGrid.setGroups()` used to `_selectedIds.clear()` unconditionally → a generation finishing mid-select (which re-feeds the grid) silently dropped the user's multi-select and kicked them out of selection mode. Fix: reconcile instead of clear — keep selected ids whose group still exists, drop only vanished ones, and `_exitSelectionMode()` only when the set empties. Any grid refresh path that replaces `_groups` must preserve live selection, not reset it.

## Selection order is click order — until a shift-click

`_selectedIds` is a `Set`, so ctrl/cmd-click order survives into every selection-bar and context-menu action, and the `#N` order badge shows it. **Shift-click REPLACES the selection** (`_rangeSelect`): it clears the set and walks from the anchor (the last ctrl-clicked card) to the clicked one in grid order, so earlier ctrl-picks outside that range are dropped. No ordering machinery exists beyond this; anything consuming selection order — Cue all's queue order, Make GIF's frame order — inherits it.

## The selection bar (MPI-945)

Entering selection mode HIDES the PromptBox (`grid.on('selection-start')` → `_pb.el.hide()`), and the grid shows its own bar in that strip, in the card menu's coarse → fine → irreversible order: `N selected` · **Cue all (N)** · Compare, Combine, Make GIF · mark dot / square / triangle / clear · Download, Archive, Delete · close (Esc works too). It is a parts file of the grid, `MpiGalleryGrid/selectionBar.js` (the `cardMarkMenu.js` precedent), appended as the grid root's last flex child and shown only under `.mpi-gallery-grid--selecting` — so the block needed no change, and the bar dies with the grid. `_syncCardSelectedState` refreshes it, which every selection change AND every render (a 16 ms debounce) runs.

- **Which surface holds what (Fabio, 2026-09-27).** Cue all, Compare, Combine and Make GIF act on a selection and live ONLY on the bar; the card menu lost them. Download, Archive and Delete are on BOTH. The bar is dumb: `_syncSelectionBar` in the grid hands every action its `disabled` and its `info` (the status-bar reason — this app has no tooltips) and gets clicks back as `onAction(key)`. The bar emits the SAME grid events the menu did (`compare`, `combine`, `make-gif`, `download`, `delete`; Archive through the shared `_archive`), so the block handlers are unchanged. Every action but a mark ends the selection, as a menu pick always did.
- **Delete is a ghost button, not `danger`** — `danger` fills a solid red block that outshouts the bar, and Delete opens its confirm anyway.

- **Marks** write `group.favourite` on every selected card and emit the SAME `favourite` event a card's own mark button does, so persistence is the old path. The mark is in the render key, so the rerender repaints the cards. A mark button is lit only when EVERY selected card wears that shape. The selection is kept, so the user can change their mind.
- **A marked card keeps its mark chip while selecting** (`MpiGalleryGrid.css`); notes, reuse and an UNMARKED mark button still hide. Before MPI-945 all three hid, which made a bar mark invisible until the selection closed.

## Cue all — one queued job per selected card (MPI-733)

Select N cards, press **Cue all (N)** on the selection bar (it was a context-menu entry until MPI-945). Each eligible card becomes its own queued job, all on the PromptBox's current recipe (prompt, style, LoRAs, controls). The PromptBox is hidden while selecting, but `hide()` is not `destroy()`, so `getRunPayload()` still returns the live recipe.

**The op is the one the user can SEE, read live.** `MpiGalleryBlock` mounts the grid with `getCueContext: () => ({ operation: activeOperation, model: activeModel })`, and the grid calls it on every bar refresh and again at click time — so an op changed mid-selection can leave the LABEL stale until the next click, never the jobs. Never `s_selectedOpByModel`: that memory is written only for USER picks, and dragging an image in auto-selects `i2i` programmatically. The first cut read the memory and was wrong both ways — greyed under a visible `i2i`, and still enabled after the chip was cleared and the strip dropped to `t2i`.

**Eligible = the op declares exactly ONE REQUIRED media slot, of the card's type.** `selectCueAllTargets(operation, model, groups)` in `js/data/commandRegistry.js`, reading slots through `getCommandMediaInputs` / `filterMediaInputsForModel` — no whitelist. The looser "any slot of that type" queues jobs that cannot run: two-required-input flows get N graphs missing an input, and optional slots make text ops "batchable". A mixed selection FILTERS to the op's type, so the label counts eligible cards, not selected ones. Zero eligible → disabled, with the reason in `data-info` (the status bar; this app has no tooltips) for `no-operation` / `not-batchable` / `wrong-media-type`.

The batch axis is an image selection; the output can be video — `i2v` / `i2v_ms` batch, so 5 photos → 5 clips. Selecting VIDEO cards batches nothing today because no model declares `extend` (Video Extend ships as a Flow). Correct as-is.

**The swept slot is the user's.** `buildCueAllJobItems(operation, model, staged, card)` takes the role of the LAST staged chip of the batched type — a role pill set to `endFrame` sweeps end frames — falling back to the op's required slot when nothing is staged. Every other staged chip rides along. The card substitutes IN PLACE, never appends: `control` / `krea2Edit` / `kleinEdit` / `qwenEdit` have ORDINAL slots where chip order decides (MPI-330). **So a queue or sidecar check must read the swept slot, not `mediaItems[0]`** — on a two-chip sweep index 0 is the fixed chip.

**Dispatch** is `_cueAllDispatch` in `MpiGalleryBlock.js`: one `getRunPayload()` read, one `enqueueGeneration` per eligible card, and **no `getNextGeneration`** — a batch job must never re-fire itself. **It refuses while Loop is armed** (`state.loopArmed`): `_onLaneDrain` re-fires the last job, so a draining batch would never end, and silently disarming the user's Loop is worse. Two traps kept out on purpose:

- The `grid.on('cue-all')` subscription sits OUTSIDE `_wirePromptBox`, which runs at two mount sites — inside it, a PromptBox remount stacks a second listener and cues every job twice.
- No `_exitSelectionMode()` in the handler: the bar's `onAction` exits after emitting, which brings the PromptBox back.

Regression spec: `tests/desktop/gallery-cue-all.spec.js` (it also covers the bar's marks, persisted to `project.json`). It mounts through the BLOCK — a grid-only mount hands the op in and cannot see the op source — and holds jobs pending with no GPU by reporting both lanes busy through `generationStore.getSnapshot`. Unit: `tests/cue-all-eligibility.test.cjs`.

## Make GIF — one click, no dialog (MPI-770)

Select 2+ cards, press **Make GIF** on the selection bar (a card-menu entry until MPI-945). Eligible = every SELECTED ITEM's `kindOfItem(item).kind === 'image'` (`js/utils/assetKinds.js`) — the `image` row is the catch-all everything else (video, audio, 3D Scene, GIF) matches first, so this one check already excludes all four. `targetIds` is used exactly as given (this file's click-order rule) — no reorder step exists client- or server-side; fixing frame order afterwards is the GIF workspace's (MPI-769) frame strip job.

`grid.on('make-gif')` in `MpiGalleryBlock.js` is modelled on `grid.on('combine')`: POST `/gif/make` (`routes/gifMake.js`, body `{ folderPath, itemIds }` in selection order) returns a plain sidecar-shaped `item` (same raw-descriptor shape `/combine-videos` returns), and the client builds the ItemGroup itself — `createImageItem` + `createItemGroup` + `appendToHistory` + `addGroup` + `grid.el.setGroups(...)`, then `navigate(PAGE_GROUP_HISTORY, { groupId })`. The route reads each item's FULL-RES file (no prompt, plan Decision 8), fits every frame into the FIRST item's pixel size (`fit: 'contain'`, exact RGBA(0,0,0,0) padding — no leaked source pixels), writes frames via `services/gifFrames.js`, and builds with each still held 1 s (delay 100) / maxEdge 1024 / loop forever.

**Built padding:** the stored frames keep the padding transparent; the built `.gif` (an opaque build, no prompt) shows it as black (`docs/gif.md` § Opaque output). Proven end to end by `tests/desktop/gif-make.spec.js`.
