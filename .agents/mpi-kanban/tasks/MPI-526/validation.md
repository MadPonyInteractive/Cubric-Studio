# MPI-526 Validation

## 2026-09-15 — closed: both member cards shipped, nothing left for the umbrella

Found stale at dispatch (MPI-677 session, Fabio approved the close). The umbrella's plan was
written 2026-08-10 as "not started"; both of its halves were closed by their own cards since:

- **Phase 1 = MPI-500, `done` / `complete`** (2026-08-29: `9097ae35`, `ae6f10b0`, `01148e16`,
  `f68ea20e`). `routes/downloadManager.js` now deletes permanently unless the user's Settings
  toggle asks for the Recycle Bin (`:44` "Absent means permanent delete"), and a failed trash
  falls back to a permanent delete (`:64`). `_trash` is lazy-loaded (`:27-33`) with a test seam
  (`_setTrashFnForTests`, `:37`).
- **Phase 2 = MPI-499, `done` / `complete`, archived** (`tasks/_archived/MPI-499/`).
  `tests/orphan-sweep.test.cjs:41-42` records the fix: the fixture no longer `ftruncate`s to the
  dep size on the false belief that NTFS makes it sparse.

No implementation ran under this card, so it closes straight from `todo`.
