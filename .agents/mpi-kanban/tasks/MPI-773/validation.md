# MPI-773 Validation

## 2026-09-16 - Server half (MPI-757 Batch 3), verified by the orchestrator

| Check | Command | Result |
|---|---|---|
| Route tests | `node --test tests/gif-transform.test.cjs` | 9/9 pass (orchestrator re-run) |
| Full node suite (worker) | `node --test "tests/*.test.cjs"` | 1140 pass, 0 fail, 1 skipped |
| Bite check (worker) | drop the background `.flatten()` in `gifToVideo.js` | transparency test red (hidden RGB leaked), restored green |

What landed: `routes/gifTransform.js` (`POST /gif/crop` with the crop tool's own `{x,y,w,h,fill}` rect
via `services/imageCrop.js`, `POST /gif/resize`), `routes/gifToVideo.js` (`POST /gif/to-video`, 30 fps
h264 from the PNG frames, odd edges padded to even with the background colour, poster + proxy via
`writeVideoDerivatives`). Both mounted in `server.js` by the orchestrator.

Orchestrator review sent the worker back once: each frame's delay was rounded to output frames on its
own, so error accumulated (delay 5 -> +33%, delay 7 -> -5%). Now cumulative rounding with a 1-frame
floor; a new test (20 x delay 5 = 30 frames, 30 x delay 7 = 63 frames) was red first (`expected ~30,
got 40`), then green.

**Still open:** the UI half (Phase 4, after MPI-772).
