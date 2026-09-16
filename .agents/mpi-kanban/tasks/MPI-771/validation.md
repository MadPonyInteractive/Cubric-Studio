# MPI-771 Validation

## 2026-09-16 - Engine half (MPI-757 Batch 2), verified by the orchestrator

| Check | Command | Result |
|---|---|---|
| Cut-out unit tests | `node --test tests/gif-cutout.test.cjs tests/gif-frames.test.cjs tests/gif-make.test.cjs` | 21/21 pass (orchestrator re-run; gif-cutout alone 8/8) |
| Bite checks (worker) | invert loop off; alpha buffer zeroed; source-encoder `flatten()` removed; last frame dropped from concat list | each red, restored green |
| Graph gates (worker) | `node scripts/validate-injection-rules.mjs` + `COMFY_URL=http://127.0.0.1:48188 node scripts/verify-workflow.mjs` on `comfy_workflows/gif_cutout_sam3.json` | pass (8 nodes) |
| Full node suite (worker) | `node --test tests/*.test.cjs` | 1108 pass, 0 fail, 1 skipped |
| Live track, existing MP4 (worker) | own `npm run app:isolated` (ComfyUI v0.34.0 pin), GPU lease, graph straight to `/prompt`, prompt `robot`, real mascot `i2v_001.mp4` (Cubric Studio Mascots, read-only) | 124 masks for 124 frames; clean silhouette |
| Live E2E through the mounted routes (worker) | 30 real frames -> `POST /gif-cutout/source` (ffv1/bgr0 .mkv, 768x768, 30 frames) -> graph under GPU lease -> `POST /gif-cutout/apply` | 30 masks for 30 frames; new entry, 30 frames, spot frame 110,840 opaque / 477,451 transparent / 1,533 soft-edge px |

Node schema facts (from `/object_info` on the pin): `SAM3_TrackToMask` returns `[N,H,W]`, one mask per
frame, no per-object output. `SAM3_TrackPreview` returns a numbered debug video, not a mask. So the UI
half reads object indices off the preview, then re-dispatches with `Input_Object_Indices`; the
`SAM3_VideoTrack` node is cached, so that re-run is cheap.

Integration (orchestrator):
- Mounted `routes/gifCutout.js` in `server.js`.
- Added `gifCutoutSam3` to `js/core/operationRegistry.js` and `operation_registry.json` at `1.6.0`
  (plan E8 corrected, see the MPI-757 drift note).
- Added `gifCutoutSam3` to `SAVES_NOTHING` in `tests/flow-output-filename.test.cjs`.
- Sent the worker back once for the missing E7 frames -> video source route.

**Still open (UI half, Batch 3):** the cut-out tool group, and the local-engine AND RunPod eye check
with Fabio (user-ux). The RunPod run rents a GPU, so it needs Fabio's go.
`docs/masking-sam3.md` sits at 242 lines, over the 200 guidance. Split it when the UI half next edits it.

## 2026-09-16 - UI half (MPI-757 Batch 3), automated checks green; user-ux check OPEN

| Check | Command | Result |
|---|---|---|
| Desktop specs (orchestrator) | `npx playwright test --config=playwright.desktop.config.js tests/desktop/gif-cutout.spec.js tests/desktop/history-modes.spec.js ... --output=<scratchpad>/pw-orch` | gif-cutout 2/2, history-modes pass |
| Component lint | `npm run lint:components` | clean |
| Full node suite (orchestrator) | `node --test "tests/*.test.cjs"` | 1141 pass, 0 fail, 1 skipped |
| Bite checks (worker) | chip guard flipped; `_handleGifCutoutApply` POST URL broken | each red, restored green |

`tests/desktop/gif-cutout.spec.js` test 2 is a real round trip with ONLY the GPU faked: the page patches
`getEngine(false/true).runWorkflow` and `.httpBase` on the live `comfyController.js` module, and a tiny
Node HTTP server stands in for `/view`. The rest is real: `/create-project`, uploads, `POST /gif/make`,
`/gif-cutout/source` (ffmpeg), Track (the stamped prompt reaches `Input_Text_Prompt.text`; a chip drop
re-dispatches `object_indices` '0,2,3' on the SAME video), Cut out through `/gif-cutout/apply` and
`/gif/ensure-frames`. Asserts: one new history entry, the sidecar `gif.frames` count, and a
`Media/.gif-frames/` PNG with alpha 255 inside the mask and 0 outside.

Decisions: no cancel hook for `/gif-cutout/source` temp videos (self-sweep; reasoning in
`docs/masking-sam3-gif.md`). `docs/masking-sam3.md` split: 242 -> 201 lines, GIF part in the new
`docs/masking-sam3-gif.md` (listed in docs/README.md).

Integration (orchestrator): the stale gif-rail assertions in `tests/desktop/history-modes.spec.js` and
`tests/desktop/gif-workspace.spec.js` now expect 1 slot (the cut-out group).
**NOT DONE, blocked on a live MPI-774 claim:** the `preloadStyles.js` line and the
`MpiToolOptionsGifCutoutProps` typedef (+ `setMaskTint` / `setMaskOverlay` lines) in `types.js`.
`guard-claim` refused both. MPI-774 was messaged (bb83d121). The component loads its own CSS, so
nothing breaks meanwhile; both hunks must land before the commit.

**OPEN (user-ux):** Fabio masks a real mascot GIF by name on the local engine AND on RunPod (renting
the Pod needs his go): shadow not in the mask, transparent background, no edge flicker worth fixing.

## 2026-09-16 - Fabio's first eye check: redesign (plan Decision 14) + `?×?` sizes fixed

Fabio redirected the design (plan Decision 14, details agreed in chat: brush fixes survive a re-track;
the brush also works with no track). The UI half is being rebuilt; the v1 panel above is superseded.

`?×?` on cut-out entries: `/gif-cutout/apply` (and `routes/gif.js` `/gif/entry`, both modes) stamped
`pixelDimensions: {w:0,h:0}`. Fabio's gif_002/003/004 sidecars all read 0x0. Both routes now read the
first frame's size through `frameDimensions()` (`services/gifFrames.js`). Existing 0x0 sidecars keep
their value until rewritten.

| Check | Command | Result |
|---|---|---|
| Route tests | `node --test tests/gif-frames.test.cjs tests/gif-cutout.test.cjs` | 18/18 pass |
| Bite | both routes put back to `{ w: 0, h: 0 }` | the two dims tests red, restored green |

`gif_003`'s dark thumbnail: its built `.gif` has no transparent pixels (sharp, page 0), because alpha
output is the GIF output toggle of Decision 4 (Phase 4, not built), so the cut background is
flattened to black. Expected until Phase 4, not a separate bug.

## 2026-09-16 - Phase 3b redesign built (session cc23c073); user-ux check OPEN

Built per plan Phase 3b (E9-E11): `MaskManager` base layer; per-frame masks on `MpiGifViewer`
(`gifFrameMasks.js`); Mask Brush = the image `MpiToolOptionsMaskBrush` under mode `gifMaskBrush`;
Cut-out panel with Track All / Track Single Frame and no count input (names stamped `name:4`);
strip marker for brushed frames. Docs: `masking.md`, `masking-undo.md`, `masking-sam3-gif.md`.

| Check | Command | Result |
|---|---|---|
| Cut-out spec (3 tests) | `npx playwright test --config=playwright.desktop.config.js tests/desktop/gif-cutout.spec.js --output=<scratchpad>` | 3/3. Test 2 is real end to end with only the GPU faked: brush a corner with NO track, Track All (corner survives), chip re-dispatch, Track Single Frame on frame 2 (empty), erase frame 1's centre, Cut out; per-frame alpha checked on disk. Test 3: base-layer pixel rules on real canvases |
| Bite: base not composited | drop `drawImage(this.baseCanvas)` in `_recomposite` | tests 2 and 3 red, restored |
| Bite: re-track wipes brush fixes | `this.edits.clear()` in `setTrackAll` | test 2 red ("a re-track keeps the brush fix"), restored |
| GIF + image-mask regression | `... gif-cutout gif-workspace history-modes gif-make gallery-gif-hover mask-persist-roundtrip mask-temp-store` | 13/13 |
| Full node suite | `node --test "tests/*.test.cjs"` | 1190 pass, 0 fail, 1 skipped |
| Component lint | `npm run lint:components` | clean |
| Tint placement (visual) | scratch probe: 64x40 frame, brush the bottom-right corner, back to Cut-out, screenshot | tint on the frame's corner (it was stretched down the full-height wrap before) |

Found and fixed on the way:
- The fake `/view` server needed `Access-Control-Allow-Origin: *`: the tint and the base layer read
  mask pixels through `crossOrigin` images, and the real engine allows it (`--enable-cors-header`,
  `routes/comfy.js`). Without it the strip tint never painted in the old spec either (nothing asserted it).
- Strip tint: `mask-mode: luminance` (opaque B/W masks tinted the whole thumb) and `cover` sizing.
- Viewer tint: `mask-size: contain` + centre (was `100% 100%` over a full-height wrap).
- `.mpi-gif-viewer__frame-wrap[hidden]` had no effect (the class sets `display`), so preview mode
  showed both images; one CSS rule.
- Brush size now survives leaving and re-entering the Mask Brush (the canvas remounts per visit).
- The spec waits for the 300 ms tool-settings debounce before switching tools; typing and switching
  faster loses the name on remount (shared `projectService` queue, every tool panel; not changed).

**Pending:** `js/components/types.js` typedefs (MPI-737 holds a live claim) — text in `types-hunk.md`.

**OPEN (user-ux):** Fabio, in his app after Ctrl+R: a real GIF, Track All by name, step frames, fix an
overlap with the Mask Brush, Cut out (local engine); RunPod later with his go.
