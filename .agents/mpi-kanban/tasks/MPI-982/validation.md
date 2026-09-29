# MPI-982 validation

Code: `f74c72dd5` fix(MPI-982): the GIF frame sweep keeps frames a writer has not named yet.

## Fix

- `services/gifFrames.js`: `holdFrames()` registers the frames a request will name in a sidecar it
  has not written yet (refcounted, per process, like MPI-976's `itemsInFlight`). `writeFrame`,
  `extractFramesFromGif` and `copyGifFrames` take the hold. `sweepGifFrames` keeps held hashes,
  runs one sweep at a time (a hold waits out the one in progress, so a frame it was deleting is
  written again), and deletes nothing while any sidecar is unreadable (ENOENT still means "names
  nothing").
- Every route that writes a GIF card takes a hold and releases it in `finally`: `/gif/ensure-frames`,
  `/gif/entry` (holds the frames it was sent, before validating them), `/gif/make`, `/gif/maker`,
  `/gif/crop`, `/gif/resize`, `/gif-cutout/apply`, `.gif` upload, add-from-cards.
- Grace window rejected: a timeout with a guessed N; GIF Maker and cut-out builds have no bound.
- `docs/gif.md` § frames store documents the hold and the unreadable-sidecar rule.

## Evidence

`tests/gif-frames.test.cjs`, three new tests, all red before the fix (12 of 12 failing, including
each of the 9 writer subtests, with the swept frame hashes listed) and green after:

- an empty sidecar (the truncate-then-write state): sweep removes 0, then removes the orphan once it reads
- a real `sweepGifFrames` run inside each writer's own sidecar `writeJson` (patched on the shared
  fs-extra object): no sidecar names a missing frame, for all 9 writers
- a hold taken while a sweep is gated mid-delete of that frame stays pending until the sweep ends

Full `npm test`: 2275 tests, 2273 pass, 0 fail, 2 skipped.

CI on `f74c72dd5`: run 36565386617, success (unit + desktop 1-4).
