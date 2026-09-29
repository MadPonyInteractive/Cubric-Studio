# MPI-977 checklist

- [x] Card todo -> doing, files.json, file claim
- [x] Checked project open: `/load-meta-batch` returns an unreadable sidecar as `{ meta: null }`, the reconciler drops the id from `project.json` and never deletes the file; Manual Cleanup (`cleanupRebuildableAssets`) already `continue`s past one. Only the per-save GC deleted it.
- [x] Test: an empty (mid-write) sidecar survives another save's GC; red before the fix
- [x] Fix: the GC skips a sidecar it cannot parse instead of treating it as orphaned
- [x] Full `npm test` green (2260 tests, 0 fail)
- [x] Line in `docs/project-integrity.md` § Orphaned sidecars
- [x] Commit by explicit paths (`f978c8b34`), push
- [x] CI green on `f978c8b34` (run 36563126446, unit + desktop 1-4), card closed in a separate commit
