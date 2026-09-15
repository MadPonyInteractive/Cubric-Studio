# MPI-770 - Make GIF from selected images

Umbrella: MPI-757 (phase 2, parallel with MPI-769). Read `tasks/MPI-757/plan.md` first; its
decision table is settled. **Needs MPI-768** (frame store and builder). It can land before MPI-769:
the card it creates simply opens in the GIF workspace once that exists.

## Scope (decided with Fabio)

- Gallery right-click on a selection -> **Make GIF**. One click, no dialog.
- **Frame order = selection order.** The gallery already keeps it: `_selectedIds` is a `Set`, so
  ctrl/cmd-click order survives into every context-menu action's `targetIds`, and shift-click
  REPLACES the selection in grid order (docs/gallery-selection.md). Use `targetIds` as given.
- Each card contributes its selected history item at **full resolution**, no prompt.
- **Size** = the first image's size; every other image is fitted inside it (contain) with
  transparent padding.
- **Defaults:** 10 fps (the GIF Maker default, inside Fabio's 10-16 range), built `.gif` at 1024 on
  the longest edge, loop forever.
- Result: a new GIF card (the `_handleCropSnapshot` new-card pattern in `MpiGroupHistoryBlock.js`:
  upload, `createItemGroup`, `addGroup`, `media:imported`), then navigate to it
  (`navigate(PAGE_GROUP_HISTORY, { groupId })`, docs/workspaces.md). Fixing the order afterwards
  is the MPI-769 frame strip's job.

## This card's calls

- When the menu entry is enabled. Suggested: 2+ cards selected and every selected item is a still
  image (no video, audio, 3D Scene or GIF). Say so in the entry's disabled reason.
- Where the context-menu entry is registered (`MpiContextMenu` in `MpiGalleryBlock.js`).

## Done when

Three images of different sizes, ctrl-clicked in a chosen order, become one GIF card whose frames
follow that order, fitted and padded to the first image's size, playing at 10 fps on hover.
