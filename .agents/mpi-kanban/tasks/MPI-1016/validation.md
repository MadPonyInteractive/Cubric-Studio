# MPI-1016 Validation

## Cause

`MpiContextMenu` opens with its top-left corner under the cursor and had no `contextmenu`
handling of its own. The right-click that opens it is prevented by the caller, so no native
menu - but the NEXT right-click lands on the menu itself, nothing prevents it, and Electron
emits `context-menu`. `main.js` answers that in dev mode with Copy / Select All / Inspect
Element, on top of ours. A right-click on a spot nobody owns did the same with our menu left
open underneath. Production never showed it only because `main.js` returns early outside
dev mode.

## Evidence

- Real OS input (SendInput) on an isolated instance, before: double right-click on a card ->
  second `contextmenu` targets `DIV.mpi-ctx-menu`, `defaultPrevented: false`, main
  `context-menu` x1 (`mediaType: none` = the screenshot's Copy / Select All menu).
- Same probe, after: second event targets the menu, `defaultPrevented: true`, main x0.
- `tests/desktop/context-menu-owns-right-click.spec.js`: fails with the listener removed
  (`Expected: 0, Received: 1`), passes with it.
- Related specs: context-menu-owns-right-click, delete-offers-archive, gallery-archive,
  gallery-stack, thumb-strip, video-history-strip, gif-workspace - 24 passed.
