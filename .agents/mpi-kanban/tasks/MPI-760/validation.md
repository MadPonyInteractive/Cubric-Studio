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


## 2026-09-17 - UI half (MPI-757 Phase 5, session 14adfdd8), auto-verified

The video rail's `exportGif` tool reads **GIF Maker** (`MpiHistoryTools` info, `TOOL_LABELS`); the
panel's `Export` button is **Apply** (`check` icon). Mode and `toolSettings.exportGif` unchanged.
Apply emits `{ fps, sizePreset, loop }`; the Block's `_handleGifMaker` posts `/gif/maker` with the
control bar's trim (`_activeVideoTrim`) and builds the new card the gallery's Make GIF way
(`createImageItem` + `createItemGroup('image')` + `addGroup`), toast "GIF saved to gallery". A busy
flag + `el.setBusy()` stop a double Apply. The Save-As path (`_handleGifExport`,
`getExportParams`, the preview-reuse cache) is gone. Preview unchanged.

Card calls: the tool stays in the video rail's `export` group (group count unchanged). No "offer to
open" dialog: there is no shared confirm primitive, and Snapshot / Save frame / GIF to Video all end
on a gallery toast, so GIF Maker does too.

| Check | Command | Result |
|---|---|---|
| New spec | `npx playwright test --config=playwright.desktop.config.js tests/desktop/gif-maker.spec.js --output=<scratchpad>` | 1/1: real 2 s clip (1 s red, 1 s blue) trimmed to 1-2 s, saved settings fps 5 / 320xauto / loop 2 load, rail has no "Export GIF", Apply reads Apply -> exactly one new card, `gif-maker`, 320x180, 5 frames delay 20, loop 2, blue pixel, video history deep-equal, opens with 5 strip thumbs |
| Bites (4) | scratchpad `bite760.py`: rail label back to Export GIF; trim not sent; no `addGroup`; panel emits `{}` | all 4 RED, files restored (byte compare) |
| GIF regression | `... gif-maker gif-transform gif-timing gif-workspace gif-cutout history-modes gif-make gallery-gif-hover` | 13/13 |
| Lint | `npm run lint:components`, `npm run lint` | clean |
| Node suite | `node --test "tests/*.test.cjs"` | 1274 pass, 0 fail, 1 skipped (first run: 1 fail in `extra-model-folders.test.cjs`, 4/4 alone and 0 fail on rerun: the parallel run races on the shared model-paths file, not GIF code) |

Spec fixture note: a fresh project has no `Media/.meta`, and `/gif/maker` 404s without it (a real
video card always has its sidecar there), so the spec creates the folder.

Docs: `docs/video-player.md` § GIF Maker (new); `docs/gif.md` points at it.

**Still OPEN:** the `types.js` typedef (`MpiToolOptionsGifProps` still describes Save-As): text in
`types-hunk.md`, blocked on MPI-774's claim 91f0ea6b (message 7a760e11).

## Fabio's sign-off, 2026-09-19

Asked directly whether the GIF cards still sitting in `doing` with validation
attention could close, Fabio answered: *"if they're GIF-related, they should be
parked in done. But then the verifications and everything are working fine."*
MPI-771's own last fix (the Mask Brush / Cut-out stroke disagreement and the
playing-tint flip, `dc97b98c`) he verified in his own app earlier the same
evening: *"it's verified. It looks good."*

That is the user verification these cards were held open for. Closed on it.
Agent access to the workspace, which is what the audit that held MPI-771 open
turned up, is its own card: MPI-830.
