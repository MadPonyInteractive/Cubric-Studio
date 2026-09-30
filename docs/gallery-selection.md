# Gallery selection — multi-select, the selection bar, Make GIF

Split out of [gallery.md](gallery.md) when that file reached the 200-line cap (MPI-733). Card
rendering, media playback and drag-drop stay there. Verify a named symbol still exists before
relying on an entry.

## Selection survives setGroups refresh (2026-07-12)

`MpiGalleryGrid.setGroups()` used to `_selectedIds.clear()` unconditionally → a generation finishing mid-select (which re-feeds the grid) silently dropped the user's multi-select and kicked them out of selection mode. Fix: reconcile instead of clear — keep selected ids whose group still exists, drop only vanished ones, and `_exitSelectionMode()` only when the set empties. Any grid refresh path that replaces `_groups` must preserve live selection, not reset it.

## Selection order is click order — until a shift-click

`_selectedIds` is a `Set`, so ctrl/cmd-click order survives into every selection-bar and context-menu action, and the `#N` order badge shows it. **Shift-click REPLACES the selection** (`_rangeSelect`): it clears the set and walks from the anchor (the last ctrl-clicked card) to the clicked one in grid order, so earlier ctrl-picks outside that range are dropped. No ordering machinery exists beyond this; anything consuming selection order — a new stack's member order, Make GIF's frame order — inherits it.

## The selection bar (MPI-945)

Entering selection mode HIDES the PromptBox (`grid.on('selection-start')` → `_pb.el.hide()`), and the grid shows its own bar in that strip, in the card menu's coarse → fine → irreversible order: `N selected` · **Stack**, Routines · Compare, Combine, Make GIF · mark dot / square / triangle / clear · Download, Archive, Delete · close (Esc works too). It is a parts file of the grid, `MpiGalleryGrid/selectionBar.js` (the `cardMarkMenu.js` precedent), appended as the grid root's last flex child and shown only under `.mpi-gallery-grid--selecting` — so the block needed no change, and the bar dies with the grid. `_syncCardSelectedState` refreshes it, which every selection change AND every render (a 16 ms debounce) runs.

- **Which surface holds what (Fabio, 2026-09-27).** Stack, Compare, Combine and Make GIF act on a selection and live ONLY on the bar; the card menu lost them. Download, Archive and Delete are on BOTH. The bar is dumb: `_syncSelectionBar` in the grid hands every action its `disabled` and its `info` (the status-bar reason — this app has no tooltips) and gets clicks back as `onAction(key)`. The bar emits the SAME grid events the menu did (`compare`, `combine`, `make-gif`, `download`, `delete`; Archive through the shared `_archive`), so the block handlers are unchanged. Stack is the one new event, `stack` → `stackGroups`. Every action but a mark ends the selection, as a menu pick always did.
- **Routines (MPI-970 D13)** is an `MpiDropdown`, the one non-button on the bar: it runs a routine the agent saved on the selection. The block feeds it through `grid.el.setRoutineMenu(fn)` and gets the pick back as `routine { name, groups }`; with no routine saved it is hidden. The bar rebuilds its options only when they change, since the sync runs on every render. Everything else about it: [routines.md](routines.md) § "The gallery's Routines menu".
- **Delete is a ghost button, not `danger`** — `danger` fills a solid red block that outshouts the bar, and Delete opens its confirm anyway.

- **Marks** write `group.favourite` on every selected card and emit the SAME `favourite` event a card's own mark button does, so persistence is the old path. The mark is in the render key, so the rerender repaints the cards. A mark button is lit only when EVERY selected card wears that shape. The selection is kept, so the user can change their mind.
- **A marked card keeps its mark chip while selecting** (`MpiGalleryGrid.css`); notes, reuse and an UNMARKED mark button still hide. Before MPI-945 all three hid, which made a bar mark invisible until the selection closed.

## Stack — replaced Cue all (MPI-949)

**Stack** took Cue all's slot on the bar (Cue all never shipped). It turns the selection into ONE stack card in click order; the stack, not a selection, is what runs one op per card now. Everything about stacks: [stacks.md](stacks.md). Disabled with the `stackCreateBlockReason` text (`STACK_BLOCK_INFO`); Compare and Make GIF refuse a selection holding a stack, since a stack owns no item and `kindOfItem(undefined)` falls to the catch-all `image` row.

**Which ops a stack can run: exactly ONE REQUIRED media slot, of the stack's kind.** `selectCueAllTargets(operation, model, groups)` in `js/data/commandRegistry.js` (the name outlived Cue all), reading slots through `getCommandMediaInputs` / `filterMediaInputsForModel` — no whitelist. The looser "any slot of that type" queues jobs that cannot run: two-required-input flows get N graphs missing an input, and optional slots make text ops "batchable". The batch axis is the input; the output can be video — `i2v` / `i2v_ms` run on an image stack, so 5 photos → 5 clips. A video stack runs no model op today because no model declares `extend` (Video Extend ships as a Flow). Unit: `tests/cue-all-eligibility.test.cjs`.

Regression specs: `tests/desktop/gallery-stack.spec.js` (replaces `gallery-cue-all.spec.js`; it keeps the bar order, `data-info`, the marks persisted to `project.json`, and archive) and `gallery-stack-run.spec.js`, which mounts through the BLOCK and holds jobs pending with no GPU by reporting both lanes busy through `generationStore.getSnapshot`.

## Make GIF — one click, no dialog (MPI-770)

Select 2+ cards, press **Make GIF** on the selection bar (a card-menu entry until MPI-945). Eligible = every SELECTED ITEM's `kindOfItem(item).kind === 'image'` (`js/utils/assetKinds.js`) — the `image` row is the catch-all everything else (video, audio, 3D Scene, GIF) matches first, so this one check already excludes all four. `targetIds` is used exactly as given (this file's click-order rule) — no reorder step exists client- or server-side; fixing frame order afterwards is the GIF workspace's (MPI-769) frame strip job.

`grid.on('make-gif')` in `MpiGalleryBlock.js` is modelled on `grid.on('combine')`: POST `/gif/make` (`routes/gifMake.js`, body `{ folderPath, itemIds }` in selection order) returns a plain sidecar-shaped `item` (same raw-descriptor shape `/combine-videos` returns), and the client builds the ItemGroup itself — `createImageItem` + `createItemGroup` + `appendToHistory` + `addGroup` + `grid.el.setGroups(...)`, then `navigate(PAGE_GROUP_HISTORY, { groupId })`. The route reads each item's FULL-RES file (no prompt, plan Decision 8), fits every frame into the FIRST item's pixel size (`fit: 'contain'`, exact RGBA(0,0,0,0) padding — no leaked source pixels), writes frames via `services/gifFrames.js`, and builds with each still held 1 s (delay 100) / maxEdge 1024 / loop forever.

**Built padding:** the stored frames keep the padding transparent; the built `.gif` (an opaque build, no prompt) shows it as black (`docs/gif.md` § Opaque output). Proven end to end by `tests/desktop/gif-make.spec.js`.
