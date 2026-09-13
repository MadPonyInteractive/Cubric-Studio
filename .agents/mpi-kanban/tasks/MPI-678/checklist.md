# MPI-678 Checklist

- [x] Implementation
  - [x] archive scope end to end (`archived` flag, `gallerySort.scope`, predicate gate, toolbar toggle, context menu, media-picker skip)
  - [x] Record relocation to the project bar + gallery-only gating
  - [x] `tests/desktop/gallery-archive.spec.js` — 3/3
  - [x] `docs/gallery.md` archive contract

Machine verification passed and both `user-ux` checks were confirmed by Fabio in the running
app (see `validation.md`). Re-verified on the current tree 2026-09-13, before commit.
