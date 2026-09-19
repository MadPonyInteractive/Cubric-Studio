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

## 2026-09-17 - UI half built and verified (session 9b06fc0e, MPI-757 Phase 4)

What landed:
- Rail groups Transform (Crop, Resize) and Export (Save frame as image, GIF to Video) in the gif list.
- Crop reuses `MpiToolOptionsCrop` unchanged: `MpiGifViewer` got a crop edit kind (`enterMode('crop')`,
  `setCropRatio` / `setCropSize` / `getCropRect`, box kept across frame steps through a new
  `MpiCanvas.setCropRect`). The Block sends the rect, fill and divisible-by rounding (as `_runCrop`)
  to `POST /gif/crop`; RESOLUTION adds `outW`/`outH`, which the route now resamples to (new route test).
- New `MpiToolOptionsGifTransform` (Resize / Save frame / GIF to Video, one panel by mode).
- Block: one landing helper `_postGifEntry` now serves the strip pill, timing tools, cut-out, crop and
  resize (three copies of the same tail folded into one). A GIF opens with NO tool: with Crop on the
  gif rail, the old "no prompt -> crop" default would have covered the frames.
- Bug fixed on the way (`_handleCropSnapshot`, video Snapshot): it called `addGroup` AND emitted
  `media:imported`, and since MPI-723 `mediaImportService` builds a card from that event, so every
  snapshot made TWO cards. Now one `_saveImageCard` (addGroup + `project:stats-dirty`) serves the
  video Snapshot and the GIF Save frame.

| Check | Command | Result |
|---|---|---|
| Route tests | `node --test tests/gif-transform.test.cjs` | 10/10 (new: RESOLUTION resample, outW without outH -> 400) |
| Transform spec | `npx playwright test --config=playwright.desktop.config.js tests/desktop/gif-transform.spec.js --output=<scratchpad>` | pass: 3 real 1440x1920 stills -> real /gif/make -> Crop 9:16 (rect 180,0,1080,1920; box kept across a frame step) -> 1080x1920 frames, delays 100 -> Speed 0.33 -> delays 303 -> GIF to Video: video card 1080x1920, fps 30, duration 9.09 +-0.1, poster + proxy on disk, pixels at 1.5/4.5/7.5 s = red/green/blue (+-12), GIF history unchanged -> Save frame: exactly ONE new card, 1080x1920, pixel exactly red |
| Bites | crop box restore removed; duplicate `media:imported` put back | both RED (step check line 158; "exactly one new card" 4 vs 3), restored |
| GIF + mask regression | gif-transform, gif-timing, gif-workspace, gif-cutout, history-modes, gif-make, gallery-gif-hover, mask-persist-roundtrip | 15/15 |
| Lint / node suite | `npx eslint js/ --max-warnings=0`; `node --test "tests/**/*.test.cjs"` | clean; 1274 tests, 0 fail |

Not this card: `tests/desktop/crop-resize-output.spec.js` is flaky on HEAD too (its `setTool` poll
waits 5 s for the image canvas source): 2 of 16 failed with HEAD's Block + MpiCanvas swapped in,
3 of 26 with ours. Reported, not fixed.

Left (peer claims, not logic): `types.js` typedefs and one `preloadStyles.js` line, text in
`types-hunk.md` (preload requested from MPI-774 in reply a550e772).

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
