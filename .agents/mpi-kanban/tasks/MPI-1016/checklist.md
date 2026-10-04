# MPI-1016 Checklist

- [x] Reproduce with REAL OS input (SendInput on an isolated, always-on-top instance): one right-click on a card is clean; a second right-click lands on `.mpi-ctx-menu`, unprevented, and main fires `context-menu` (dev mode pops Copy / Select All / Inspect Element over our menu).
- [x] Rule out the other suspects: a real right-click on any `preventDefault` target never reaches main, video or image card alike.
- [x] Fix in `MpiContextMenu.show`: a capture-phase `contextmenu` listener - on the menu it prevents default, elsewhere it closes the menu.
- [x] Regression spec `tests/desktop/context-menu-owns-right-click.spec.js`: fails without the fix (native count 1), passes with it.
- [x] Related context-menu specs green (24/24).
