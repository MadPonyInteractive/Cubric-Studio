# MPI-1031 checklist

Fabio, 2026-10-06: while a video generates he can mark its card (dot, square, triangle); when the
video lands the mark is gone.

Root cause: the generating card is the run's PLACEHOLDER group (MpiGalleryBlock `mkPlaceholder`,
held by `activeGenerations` and handed to the grid by reference). The mark button writes
`placeholder.favourite` and emits `favourite` -> `updateGroup`, which finds no such id in the
project (a no-op). On completion `generationService` builds the card fresh with
`createItemGroup`, never reading the placeholder - so the mark is dropped.

- [x] `generationService.js` gallery branch: each built group takes its placeholder's mark
      (placeholderGroup for the first output, extraPlaceholders for the rest)
- [x] desktop spec: marking the generating card lands on the run's own placeholder object
- [x] `docs/gallery-filters.md` § Card marks: a generating card's mark carries over
- [x] Fabio checks it live (mark a generating card, it keeps the mark when it lands)
