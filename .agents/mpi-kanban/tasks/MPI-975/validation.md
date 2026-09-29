# MPI-975 Validation

## Bug

Stack History, Remove BG over a 4-member image stack: one result (`removeBackground_004`) showed a
broken image in the strip and the History list, while the canvas showed it fine.

## Root cause (measured)

On disk the item had `<id>.thumb.1280.webp` but no `<id>.thumb.webp`, while its sidecar named both.
No `image thumb failed` warning in `app.log`, so the thumb was written and then deleted.

`/project/save-generation` ran a per-save `.meta` GC whose Pass 2 deleted any derivative whose id had
no sidecar. Every writer lays an item's renditions (512, then 1280) BEFORE its sidecar, so a
concurrent save's GC read the directory between the other item's 512 and its sidecar and deleted
that 512. The 1280, written after the readdir, survived. A stack batch saves N results at once.

The broken card never heals: the backfill pass gates on the sidecar field, not the disk.

## Fix

Pass 2 removed. Its stated purpose was thumbs leaked by delete paths before they learned to clean up;
every delete path now runs `removeItemThumbs`, and Manual Cleanup sweeps derivatives. Pass 1 (drop a
sidecar whose media is gone, with its derivatives) stays.

## Evidence

- `tests/save-generation-gc.test.cjs`: failed before the fix (`...thumb.webp was swept by another
  item's save`), passes after.
- Save-generation neighbours (splat-companion, sharp-16k-inputs, audio-media-type,
  flow-output-filename, gallery-renditions, gif-frames): pass.
- Full `npm test`: 2255 tests, 2253 pass, 0 fail.
- A read-only scan of every project under the user's Projects folder found exactly one sidecar whose
  thumb file was missing (this one); it was re-made with the app's own `extractImageThumb`.

## Not fixed here

Pass 1 has a narrower race of the same shape: a preview-to-final replace (`replaceItemId`) that
rewrites its sidecar and deletes the old media between another save's GC read of that sidecar and
its `pathExists` check would drop the NEW sidecar. Not observed; noted only.
