# MPI-760 Validation

## 2026-09-16 - Server half (MPI-757 Batch 3), verified by the orchestrator

| Check | Command | Result |
|---|---|---|
| Route tests | `node --test tests/gif-maker.test.cjs` | 4/4 pass (orchestrator re-run) |
| Full node suite (worker) | `node --test "tests/*.test.cjs"` | 1139 pass, 0 fail, 1 skipped |
| Bite check (worker) | fps -> delay `+ 1` | red (`[11 x10]`), restored green |

What landed: `routes/gifMaker.js` (`POST /gif/maker`, body = `_encodeGif`'s body plus `folderPath`;
full-res frames at the fps inside the trim, through `services/gifFrames.js`; returns a raw sidecar
descriptor for a NEW card, decision 13). Mounted in `server.js` by the orchestrator.

Orchestrator review sent the worker back once: `480xauto` / `autox480` name a WIDTH / HEIGHT (as
`routes/videoGif.js`'s preview does), not a longest-edge cap. `buildGif` only takes a box, so the route
derives the box from the frame aspect. The new portrait/landscape test was red first (`got 180x320`),
then green. A source smaller than the preset is never upscaled (the preview encoder does upscale).

**Still open:** the UI half (Phase 5).
