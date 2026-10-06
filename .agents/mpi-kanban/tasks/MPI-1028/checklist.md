# MPI-1028 checklist

Fabio, 2026-10-06: with the FILTER on Dots only, a running ref2v generation had no card in the
gallery; unfiltered, the generating ref2v card wore the Image chip.

Root cause: the generating placeholder (MpiGalleryBlock `mkPlaceholder` / stage-2 placeholder)
carries the input frame as a `type: 'image'`, `inputPreview: true` history item, and is unmarked.
`matchesGallerySort` read its kind off that frame and its mark as none, so any marks filter (or
hiding Images) dropped it; the grid's kind chip read the same frame.

- [x] `galleryFilter.js`: a generating placeholder passes kinds/marks/previews (scope still gates)
- [x] `galleryFilter.js`: kind of an input-preview frame (or no item) = the group's type, exported for the chip
- [x] grid chip reads the same helper, so a generating card shows the kind it is MAKING
- [x] `tests/gallery-filter.test.cjs` covers both
- [x] `docs/gallery-filters.md` updated
- [x] live check: desktop spec (isolated Electron, port 64814), red before the fix, green after
