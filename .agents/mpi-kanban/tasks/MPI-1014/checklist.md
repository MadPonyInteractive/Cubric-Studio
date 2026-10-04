# MPI-1014 checklist

- [x] Phase 1: every Flow screen draws the display copy (slot chip, result pane, picker preview, box, preview, crop, paint, cutout, place) + `/display-image` for sidecar-less files
- [x] Phase 2: no `compose*` builds a source-size canvas past the cap (all fixed, no refusal needed)
- [x] Phase 3: docs/big-photos.md + spec RED-proven + unit tests
- [x] Real 32K in real Chromium (chip, Paint, Box, Crop); no GPU generation run
- [x] Phase 4: a new image in a slot resets the step state of steps on that role and of steps whose `sourceRole` is it (picker pick + upload/drop, same rule as the X button); spec RED first
- [x] Cutout + Paint brush grow with the picture (Fabio 2026-10-04: the cutout brush capped tiny on a 16K): `brushScale` scales default, cap and wheel step; spec RED first
- [x] Fabio's look - found Phase 4 and the brush, then "1" 2026-10-04 (close once CI green on `1193fd7c0`)
