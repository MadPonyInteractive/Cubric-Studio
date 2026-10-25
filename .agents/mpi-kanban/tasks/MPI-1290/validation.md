# MPI-1290 validation

Cause: the gallery's compare handler passed two history items to MpiCompareOverlay; the
card's user-set name lives on the group (`customName`), which no item carries, so labels
fell back to the item name / file name. Fix: `open(itemA, itemB, names)` threads both
card names from MpiGalleryBlock through MpiCompareOverlay to MpiCompareView's labels.

Check: `tests/desktop/compare-card-names.spec.js` (own isolated app) — a named side shows
the card name, an unnamed side and a call without names keep the item's label. Passed.
History-panel compare does not pass names, so it is unchanged. Lint + unit tests green on push.
