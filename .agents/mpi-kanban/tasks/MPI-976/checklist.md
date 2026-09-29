# MPI-976 checklist

- [x] Card todo -> doing, files.json, file claim
- [x] Deterministic test forcing the interleave (GC reads old sidecar -> rewrite lands and drops the old media -> GC checks the old media); fails before the fix
- [x] Fix: module-level `itemsInFlight` in `routes/projects.js`; the GC never deletes a sidecar whose id is in it. Swept a second same-id rewrite: `/gif/entry` update (`routes/gif.js`), registered too
- [x] Full `npm test` green (2258 tests, 0 fail)
- [x] One line in `docs/project-integrity.md` § Orphaned sidecars
- [x] Commit by explicit paths (`dfc741b09`), push
- [x] CI green on `dfc741b09` (run 36559592330, unit + 4 desktop shards), card closed in a separate commit
- [x] Follow-up filed: MPI-977 (torn read of a sidecar another route is writing)
