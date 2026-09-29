# MPI-977 validation

Code commit: `f978c8b34` - fix(MPI-977): the save GC skips a sidecar it cannot parse.

## Root cause

save-generation's GC `readJson`s every sidecar; on a throw it fell back to `Media/<uuid>` as the
media path (never a real file) and deleted the sidecar plus `removeItemThumbs`. `writeJson` is
open-with-truncate, then write, so a read in between sees an empty file. Any sidecar written by a
route outside save-generation (MPI-976's `itemsInFlight` covers save-generation and the two
same-id rewrites only) could be deleted that way.

## What an unreadable sidecar meets elsewhere (checked before choosing the fix)

- Project open: `/load-meta-batch` returns it as `{ meta: null, exists: false }`; the reconciler
  (`js/managers/projectReconciler.js`) tries a synthetic item, else drops the id from
  `project.json`. It never deletes the file.
- Manual Cleanup (`cleanupRebuildableAssets`): `catch { continue; }` past it.

So the per-save GC was the only reader that deleted one. A genuinely corrupt sidecar now stays
on disk as a stray file, the same as those two paths already leave it.

## Fix

The GC's `catch` now `continue`s (skips) instead of treating the sidecar as orphaned. The
`Media/<baseName>` fallback for a READABLE sidecar with no `filePath` is untouched.
Documented in `docs/project-integrity.md` § Orphaned sidecars.

## Evidence

- `tests/save-generation-replace-gc.test.cjs` - "a sidecar caught mid-write survives another
  save's GC": an empty `<id>.json` (the truncated state) plus its thumb, then a plain save.
  Red before the fix (`a sidecar mid-write was deleted as an orphan`), green after. The two
  MPI-976 cases and MPI-975's test stay green.
- Full `npm test`: 2260 tests, 2258 pass, 0 fail (exit 0).
- CI on `f978c8b34`: run 36563126446 success (unit + desktop 1-4).

## Not covered (found while checking)

`sweepGifFrames` (`services/gifFrames.js`) builds its set of referenced frames from every
sidecar and skips one it cannot parse, so a GIF sidecar caught mid-write loses its frames to a
concurrent sweep. Same torn read, opposite effect (it deletes what the sidecar REFERENCES).
Filed as MPI-982.
