# MPI-982 - GIF frame sweep vs a GIF another request is writing

Found while fixing MPI-977 (read the code, not observed live).

## The race

`sweepGifFrames(mediaDir)` (`services/gifFrames.js`) builds the set of frame hashes that every
sidecar in `Media/.meta/` references, then deletes every stored frame in `Media/.gif-frames/`
outside that set. It runs after a GIF update (`routes/gif.js` `/gif/entry` mode `update`) and
after a delete (`routes/projects.js` media delete and `DELETE /delete-meta`).

Two ways it deletes frames that are still wanted:

1. **Frames land before their sidecar.** Every GIF writer stores its frames first, then writes
   the sidecar that references them: `gifCutout`, `gifMake`, `gifMaker`, `gifTransform`,
   `/gif/ensure-frames` (`extractFramesFromGif`), and upload/import of a `.gif`
   (`routes/projects.js` ~1629). A sweep in between sees no sidecar naming them and deletes
   them. Same shape as MPI-975 (derivatives laid before the sidecar).
2. **A sidecar read mid-write is skipped.** `writeJson` truncates, then writes; the sweep's
   `readJson` in between throws, it `continue`s, and that GIF's frames look unreferenced. Same
   torn read as MPI-977, opposite effect: MPI-977 deleted the sidecar, this deletes what it
   references.

Result: the `.gif` itself survives, but its sidecar names frames that are gone. Editing the GIF
then fails (`/gif/entry` rejects `unknown frame hash`), or a build still in progress fails.

## Direction (not decided)

- An unreadable sidecar must make the sweep keep EVERYTHING this pass (skip the delete),
  never read as "references nothing". One line; closes trigger 2.
- Trigger 1 needs the sweep to know about frames still in flight. Options: a grace window
  (only delete frames older than N minutes, by mtime), or register in-flight frame hashes the
  way MPI-976 registers ids (`itemsInFlight` in `routes/projects.js`). The grace window covers
  every writer with no per-route wiring; check `gifMaker`'s long builds against N.

Whatever lands needs a deterministic test that forces each interleave. The shape to copy is
`tests/save-generation-replace-gc.test.cjs` (MPI-976/977): patch fs-extra's shared module
object, or lay the mid-write state on disk (an empty sidecar) before the sweep runs.
`tests/gif-frames.test.cjs` already builds real frames and runs `sweepGifFrames`.
