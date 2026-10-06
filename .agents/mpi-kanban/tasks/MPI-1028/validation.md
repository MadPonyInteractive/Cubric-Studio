# MPI-1028 validation

## Fix

- `js/utils/galleryFilter.js`: `matchesGallerySort` lets a generating placeholder through after
  the scope gate (kinds, marks, Previews no longer hide it). New exported `kindItemOf(group, item)`
  replaces the private `_kindItem`: a stack reads as `group.kind`, a card with no item or only an
  `inputPreview` frame reads as `group.type`.
- `MpiGalleryGrid.js` kind chip reads `kindItemOf(_faceOf(group), selected)`, and a generating
  card with no item gets a chip too (the kind it is making).

## Evidence (2026-10-06)

- `node --test tests/gallery-filter.test.cjs tests/asset-kinds.test.cjs` 25/25, incl. the new
  MPI-1028 case (Dots only, hidden Videos + Previews, archived scope, `kindItemOf`).
- `tests/desktop/gallery-filter-panel.spec.js` new step: a ref2v-shaped placeholder (unmarked,
  `inputPreview` image item) started through `activeGenerations.start` under `marks: ['dot']`
  renders (`gen1` + `vid1`), chip `data-kind="video"` `data-accent="video"`; torn down to ALL.
  Green (10.1 s). **Red with the HEAD versions of the two source files swapped in** (`gen1`
  missing from the card list), green again restored.
- eslint clean on both files.
- CI: Tests run 37428171291 on 806cd12bb, success (and Red master watch 37428345519, success).

## Left as is

A finished run that does not match the active filter drops out when it lands (the filter doing
its job). Fabio, 2026-10-06: leave it as is.
