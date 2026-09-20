# MPI-835 checklist

- [x] Reproduce on Fabio's real BiRefNet mask (engine temp, frame 62): `alpha > 0` adds 3.3% keep area over the soft mask
- [x] `MaskManager.getURL(bg, fg, soft)` — coverage-preserving B/W export; image mode's binary export untouched
- [x] `MpiCanvas.getMaskDataURL` passes `soft` through
- [x] `MpiGifViewer` — all three exports (`_saveEdit`, `_recompose`, the playing tint) ask for `soft`
- [x] Test: a soft base round-trips through the export unchanged; a brushed pixel still lands (red on pre-fix, green on fix)
- [x] `docs/masking-sam3-gif.md` — the composed mask keeps coverage, and why
