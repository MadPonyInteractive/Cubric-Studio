# MPI-1160 checklist

- [x] Picker lays tiles out with the Gallery's packer (`buildJustifiedRows`), each tile at its own aspect, picture whole
- [x] Names still under each tile; upload / mic / voice cards still first; filter, upload, pick, preview unchanged
- [x] Relayout on resize and when a tile with no `pixelDimensions` reports its real size
- [x] `tests/desktop/media-picker-cards.spec.js` passes, plus a check that a wide sheet tile is wider than a portrait tile
- [x] Eye test by Fabio (PASS 2026-10-16; audio tiles made square on his note)
