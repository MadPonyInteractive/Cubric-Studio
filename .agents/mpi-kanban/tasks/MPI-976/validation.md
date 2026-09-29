# MPI-976 validation

Code commit: `dfc741b09` - fix(MPI-976): the save GC never deletes a card mid-rewrite.

## Root cause

save-generation's GC decides "orphan" from two separate awaits: read a sidecar's `filePath`,
then `pathExists` on it. A same-id rewrite writes the new sidecar, then deletes the old media.
A GC whose read landed before the rewrite and whose check landed after saw the old media gone
and deleted the NEW sidecar plus every thumb (`removeItemThumbs`).

The sweep found TWO routes with that shape, not one:

- `POST /project/save-generation` with `replaceItemId` (preview->final Continue) - the brief's case
- `POST /gif/entry` mode `update` (`routes/gif.js`) - same id, new `.gif`, old one removed (E5)

## Fix

`itemsInFlight` (module-level `Set` in `routes/projects.js`, exported). save-generation adds its
id once known and drops it in `finally`; the GIF update does the same. The GC checks the set
AFTER the `pathExists` await, i.e. at the delete decision. Documented in
`docs/project-integrity.md` § Orphaned sidecars.

## Evidence

- `tests/save-generation-replace-gc.test.cjs` forces the interleave by patching fs-extra's
  `pathExists` / `remove` (one shared module object): the GC's check of the old media starts
  the rewrite and waits for the old media to be deleted; the rewrite is held there, in flight,
  until the GC's save has answered.
  - Before the fix: both cases red, `<id>.json was deleted by another save's GC`.
  - With only the `routes/projects.js` half: the GIF case still red, same message. Each half is
    load-bearing.
  - With the fix: both green, plus MPI-975's `save-generation-gc.test.cjs`.
- Full `npm test`: 2258 tests, 2256 pass, 0 fail (exit 0).
- CI on `dfc741b09`: run 36559592330 success (unit + desktop 1-4).

## Not covered (follow-up)

The same GC treats a sidecar it cannot PARSE as orphaned (fallback `Media/<uuid>` never exists),
so a torn read of a sidecar another route is writing at that moment (gif new, gifCutout, video
crop/reverse/concat, upload - any writer outside save-generation) deletes it. Different trigger,
same outcome; not in this card's scope. Filed as MPI-977.
