# MPI-976 - save-generation GC vs a preview-to-final replace

Found while fixing MPI-975 (read the code, not observed live).

## The race

`POST /project/save-generation` (`routes/projects.js`) ends with a GC over `Media/.meta/`: for each
sidecar it reads `filePath`, then `pathExists(media)`, and on a miss removes the sidecar and runs
`removeItemThumbs`.

A multi-stage Continue posts the same route with `replaceItemId`. That save writes the NEW sidecar
at the SAME id, then deletes the PREVIOUS media file (`_replacePrevMediaPath`).

Interleave save B's GC with replace A:

1. B reads A's sidecar - still the OLD one, pointing at the preview media.
2. A writes its new sidecar, then removes the preview media.
3. B checks `pathExists(preview media)` - false - removes A's NEW sidecar and all its derivatives.

Result: the card's sidecar is gone (card 404s / vanishes on reload), its thumbs with it. The window
is milliseconds, but stack batches (MPI-949) make concurrent saves routine.

## Direction (not decided)

- The GC must not act on an id whose save is in flight in this process (a module-level Set of ids,
  added at route start, removed in `finally`, checked at the delete decision), or
- re-read the sidecar at the delete decision and skip if its `filePath` changed.

The first closes it; the second only narrows it. Whatever lands needs a deterministic test that
forces the interleave (MPI-975's `tests/save-generation-gc.test.cjs` is the harness shape).

MPI-975 already removed the GC's other pass (derivatives with no sidecar), which is what broke a
stack Remove BG thumb. See `docs/project-integrity.md` § Orphaned sidecars.
