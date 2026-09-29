# MPI-977 - save-generation GC vs a sidecar read mid-write

Found while fixing MPI-976 (read the code, not observed live).

## The race

`POST /project/save-generation` (`routes/projects.js`) ends with a GC over `Media/.meta/`. For
each sidecar it `readJson`s it; if that THROWS it treats the sidecar as orphaned, falls back to
`Media/<uuid>` as the media path (sidecars are uuid-keyed, so that file never exists), and
deletes the sidecar plus `removeItemThumbs`.

`fs.writeJson` is open-with-truncate, then write, as separate threadpool ops. A GC `readJson`
between the two reads an empty file, the parse throws, and the GC deletes a sidecar that is
being written right now. The card vanishes on reload.

MPI-976's `itemsInFlight` covers save-generation's own writes and the two same-id rewrites. It
does NOT cover a sidecar written by any other route while a save's GC runs: `/gif/entry` new,
`gifCutout`, `gifMake`, `gifMaker`, `gifTransform`, `gifToVideo`, `videoCrop`, `videoReverse`,
`videoConcat`, upload / imported, add-from-cards.

## Direction (not decided)

- A sidecar the GC cannot parse is not evidence its media is gone: skip it instead of deleting
  (corrupt sidecars are then left for Manual Cleanup / project-open reconciliation), or
- register every sidecar writer in `itemsInFlight`, or
- write sidecars atomically (temp file + rename) so a reader never sees a torn file.

The first is one line and covers every writer; check what reconciliation does with a corrupt
sidecar before choosing. Whatever lands needs a deterministic test in the shape of
`tests/save-generation-replace-gc.test.cjs` (patch fs-extra's `readJson` to throw once).
