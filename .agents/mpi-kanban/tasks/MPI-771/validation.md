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

## 2026-09-16 - Fabio's six findings fixed (session d58ac006); user-ux re-check OPEN

Fabio's calls: 1a (a drag scrubs, hold then drag reorders, Discard, masks follow their
frames), 2b (a note in the GIF Mask Brush, no second Cut out button), 3a (Play in the Mask
Brush plays the frames under their tint).

Root causes:
- **Trim bar collapsed:** not the Mask Brush. `MpiGifControlBar.attachViewer()` runs before any
  frame loads; with 0 frames `setRangeQuiet(0,0)` clamps the out point to the one-frame
  minimum (frame 1), and `setFrameCount()` only called `setDuration()`, which clamps and never
  widens. Reproduced in an isolated app: a fresh 30-frame GIF had out = 3.45%. Now a changed
  count resets the range to all frames.
- **"8 frame changes" + masks gone:** a plain thumbnail drag past 4 px staged a reorder, and
  `setFrames()` then emptied every position-keyed mask. Now a drag scrubs; a 300 ms hold lifts
  the thumb for a reorder; the strip sends `order` and `gifFrameMasks.remap()` carries the
  masks; Update/Apply reload the same list so they are kept; the pill gained Discard.
- **Frame tiny:** the frame img only shrank (`max-width/max-height`); the wrap and img now fill
  the stage with `object-fit: contain`, the tint uses the same box.
- **Grow / Fill Holes / Invert reset** on every panel mount; now saved in `toolSettings.gifCutout`.
- Chip re-dispatch of a single-frame scope now follows its frame after a reorder (by hash).

| Check | Command | Result |
|---|---|---|
| Cut-out + workspace specs | `npx playwright test --config=playwright.desktop.config.js tests/desktop/gif-cutout.spec.js tests/desktop/gif-workspace.spec.js --output=<scratchpad>` | 5/5 (new test 4: trim, fill, drag scrubs, hold-drag, masks follow, Discard, Update keeps masks, Play in the brush; test 2: Invert survives a trip to the brush + the brush note) |
| Bites (7) | scratchpad `bite.py`: trim reset removed; press->reorder on move; masks cleared on reorder; img max-width; play blocked in edit; strip commit clears overlay; invert not restored | all 7 RED, all files restored (cmp against backups) |
| GIF + image-mask regression | `... gif-cutout gif-workspace history-modes gif-make gallery-gif-hover mask-persist-roundtrip mask-temp-store` | 14/14 |
| Node suite | `node --test "tests/*.test.cjs"` | 1213 pass, 0 fail, 1 skipped |
| Lint | `npm run lint` / `npm run lint:components` | clean |

Docs: `docs/masking-sam3-gif.md` (masks follow a reorder, Play in the brush, settings persist,
tint box), `docs/video-player.md` (strip gestures, trim reset). New
`MpiToolOptionsMaskBrush.css` registered in `js/shell/preloadStyles.js`. `types.js` still
blocked by MPI-737's claim: text appended to `types-hunk.md`.

**OPEN (user-ux):** Fabio, after a FULL app restart (server code changed too, and gif_005's
`?x?` fix was server code): real GIF, Track All, drag the strip (it must scrub), hold-drag a
frame (masks stay), Discard, brush a fix, Play in the Mask Brush, Cut out.

## 2026-09-17 - Fabio's second check: strip drag + preview button (session 93c7703f); user-ux re-check OPEN

Fabio's check found: a held thumb shows a "copy" and runs ahead of the mouse; Discard stuck at
"18 frame changes"; Discard left two brushed masks; the GIF preview button is dead in the Mask
Brush. His call on the masks: **Discard stays frames-only** (a) - masks keep Clear + Ctrl+Z.

Reproduced first (isolated Electron, CDP `window.mouse`, 30 frames, scratch probes):
- **Overshoot:** a 140 px hold-drag (2 slots) moved the thumb 4 slots, 140 px ahead of the
  cursor. `_onMove` moved a full slot at half a slot of travel, then reset `startX`.
- **"Copy" + stuck gesture:** a scrub that STARTS in empty track fired `selectstart`. With a
  selection spanning the strip (scrub dragged up into the viewer, or Ctrl+A), a hold-drag fired
  `dragstart` on the thumb (Chromium's native drag ghost), then `dragend` and no `mouseup`:
  the lift stayed painted and hovering with no button reordered (2 -> 6 changes).

Root cause: the strip never owned its press. Fix: `pointerdown` + `preventDefault` + pointer
capture on the track + `pointercancel` (MpiTrimBar's idiom), blur the focused element (a
prevented press keeps focus; hotkeys skip text fields), held thumb at
`liftIndex + round(dx / SLOT)`. Viewer emits `'edit-change'`; the control bar disables its
preview button while the brush is up. After the fix both probes: no `selectstart`, no
`dragstart` even under Ctrl+A, the lift drops on release, hover never edits, the lifted
thumb's centre equals the cursor x at every step.

| Check | Command | Result |
|---|---|---|
| Cut-out + workspace specs | `npx playwright test --config=playwright.desktop.config.js tests/desktop/gif-cutout.spec.js tests/desktop/gif-workspace.spec.js --output=<scratchpad>` | 5/5 (test 4 gained: press blurs a text field, 140 px = 2 slots under the pointer, no native drag under a full selection + hover never edits + Discard stays, preview disabled in the brush and back on Cut-out) |
| Bites (5) | scratchpad `bite.py`: old slot math; mouse events without preventDefault; pointer events without preventDefault; no blur; no `edit-change` listener | all 5 RED, files restored (byte compare) |
| GIF + image-mask regression | `... gif-cutout gif-workspace history-modes gif-make gallery-gif-hover mask-persist-roundtrip mask-temp-store` | 14/14 (first run 13/14, see below) |
| Workspace stability | `... gif-workspace --repeat-each=3` | 3/3 |
| Node suite | `node --test "tests/*.test.cjs"` | 1267 pass, 0 fail, 1 skipped |
| Lint | `npm run lint` / `npm run lint:components` | clean |

`gif-workspace.spec.js`: strip gestures now use `window.mouse` / `locator.click({ modifiers })`
(the synthetic `MouseEvent`s never reach pointer listeners, and never started the native drag
that shipped). Its first regression run failed "Apply must add a new history card" (1 vs 2):
the stub records the call BEFORE its response lands, and the spec read the card count at
once. It now polls the pill and the card count. Before that change it passed in the two other
runs; after it, 14/14 in the regression set and 3/3 repeated.

Docs: `docs/video-player.md` (the strip owns its press, why, Discard frames-only),
`docs/masking-sam3-gif.md` (`'edit-change'`). `types.js` still blocked (MPI-737 in doing, the
file dirty): text appended to `types-hunk.md`.

**VERIFIED (user-ux, local engine) 2026-09-17:** Fabio in his app (renderer-only change, Ctrl+R):
held thumb under the cursor with no "copy", hold-drag under a selection, Discard twice, preview
button greyed out in the Mask Brush. He answered "1" (looks good).

**Still OPEN for this card:** RunPod check with Fabio's go; the `types.js` hunk (`types-hunk.md`)
once MPI-737 releases the file.


## 2026-09-17 - strip pill shown when nothing is staged (session 9b06fc0e, found during MPI-772)

`.mpi-frame-strip__pill { display: flex }` beat the `[hidden]` attribute, so the Discard / Update /
Apply pill sat on screen with an empty count whenever a GIF card was open (visible in the MPI-772
spec screenshots, over the history list). This is how an Apply "in the Mask Brush" could save an
identical entry with no staged change (Fabio's first check). The specs asserted `pill.hidden`, the
attribute, so they never saw it. Fix: `.mpi-frame-strip__pill[hidden] { display: none; }`. Specs
now assert `checkVisibility()` (gif-workspace.spec: new "no pill before any edit" check;
gif-cutout.spec `pillHidden`).

| Check | Result |
|---|---|
| gif-workspace.spec before the CSS fix | RED: "no pill before any edit" (Received false) |
| GIF desktop set after (gif-timing, gif-workspace, gif-cutout, history-modes, gif-make, gallery-gif-hover) | 11/11 |


## 2026-09-17 - RunPod check PASSED (session 14adfdd8, Fabio's own app)

Option chosen with Fabio: his app, he clicks, the agent reads (never `:3000`). Pod `avb48jl48yrzgy`
(`cubric-vision`), RTX 2000 Ada 16 GB, connected ~12:06Z (the 10 universal node packs installed onto
the volume 12:06:55-12:07:22). Fabio: Ctrl+R, "GIF Tests" project, card `imported_015` (320x320 mascot,
30 frames), Cut-out, name **logo**, Track All (4 tracked objects, 0-3), Cut out -> entry `gif_006`
320x320 holding only the logo (he did not tick Invert; keeping the named object is the designed result).

| Evidence | Source | Reading |
|---|---|---|
| Track ran on the Pod | RunPod console, container log (Fabio's screenshot) | 13:19:40-13:19:43 BST (12:19:40Z) `GET /wrapper/view?filename=ComfyUI_temp_ihygj_00015_.png&type=temp` ... `_00030_` all 200: the app pulling the per-frame mask PNGs through the wrapper |
| Engine was remote | Fabio's app screenshot, status bar | `IDLE · REMOTE`, VRAM 2.1 / 16 GB (Pod telemetry; SAM3 has ample room on 16 GB) |
| Result | Fabio's app screenshot | new entry `gif_006` 320x320, logo on transparent, strip frames follow |

**`app.log` cannot prove a remote run.** Its `[comfy]` lines are the LOCAL engine's stdout
(`routes/comfy.js` `_handleComfyOutput`), and every app instance on the machine, desktop specs included,
writes the same file: a SAM3 load at 12:17:41Z there was not this check. The remote path logs nothing
on success, so the watch on `app.log` stayed silent for 30 min. The Pod's own container log is the proof.

Pod: Fabio disconnected at ~12:25Z (the Disconnect -> Delete path writes no `app.log` line).

## 2026-09-17 - header ENTRIES count stale after a GIF tool Apply (found in the RunPod screenshot)

The header read `2 ENTRIES` over three history rows. Not `gif_005` (an old entry): the count is fetched
per history file (`projectStatsService.refreshGroup`) and refreshed only on `history:stats-dirty`, which
`_postGifEntry` never emitted, so the header kept the count from when the card opened. Same gap at every
other append site that persists without emitting it: video crop, video reverse, combine, and image
crop/paint/place (`_appendViewerEntry`). Fix, once for all: `_persistGroup()` emits
`history:stats-dirty` when the history's `id|filePath` list changes (a selection change keeps the key,
so no extra fetch; an in-place GIF Update changes `filePath`'s `v=` and refetches the size).

| Check | Result |
|---|---|
| `gif-transform.spec.js` (new assertion: after Crop Apply the header count is `before + 1`) | green |
| Bite: the new emit removed | RED (`Expected "2"`, `Received "1"`), file restored byte-exact |
| Every desktop spec that opens group history (crop-resize-output, flow-audio-player, gallery-filter-panel, gif-cutout, gif-maker, gif-timing, gif-transform, gif-workspace, history-modes, mask-persist-roundtrip, media-import-outside-gallery, workspace-sweep) | 27/27 |
| `npm run lint:components` | clean |

**Still OPEN for this card:** the `types.js` hunk (`types-hunk.md`), MPI-774 claim 91f0ea6b.

## 2026-09-17 ~14:00Z - Fabio's UI pass: unusable cut-outs, mask methods (Decision 15)

**Root causes, proven on his `test` project (GIF Tests) before any code:**
- Every cut pixel came back black: `/gif-cutout/apply` built with the SOURCE entry's `output`
  (`edgeColour: null`, opaque), which flattens alpha onto black. gif_009's SAM3 robot mask was
  clean (77% transparent); rebuilt transparent in scratch and composited on green: correct.
- gif_012 (Transparent applied) kept its background because gif_010's mask kept 99% of each frame.
- Prompt "Background" with Invert off keeps the background; SAM3's background mask stops short of
  the frame edge in patches (40-48% of the border ring transparent), the dashed border. The source
  has no dark border (0 of 1280 edge pixels dark).
- `Number(null)` stored `colours: 0` in `routes/gif.js`, `gifCutout.js`, `gifTransform.js`.

**Built:** Cut out always transparent (`edgeColour` default black) + sidecar `cutout` record; the
`colours` fix in all three routes; `gif_cutout_birefnet.json` (raw + API, converted against the 8188
bench with Fabio's go) registered in the four op registries; `js/utils/colourKeyMask.js`; Cut-out
method switch (Remove background default / By name / By colour), per-method hint, viewer spinner +
status bar clock; masks stashed per frame list (`gifFrameMasks.js`); checker behind GIF frames.

| Check | Result |
|---|---|
| Real BiRefNet graph on the 8188 bench, GPU lease, Fabio's 30-frame `imported_015` through the app's own encoder + `applyMaskAlpha` | success, 30 masks in 16.2 s; contact sheet on green clean, arm pockets removed. Probe video staged in `G:/ComfyUi/ComfyUI/input` and removed |
| `validate-injection-rules.mjs` on the converted graph | conforms |
| `node scripts/release-health-check.mjs` | no op-registry failure (pre-existing release-note / smoke-evidence failures only) |
| `node --test tests/colour-key-mask.test.cjs` (new) | 6/6 |
| Colour key on Fabio's real frames (320 and 768 px) at tol 16 / 32 / 16+edges | 16 clean with pockets removed; 32 eats the face; edges-only keeps the pocket. Default 16 |
| `node --test tests/gif-cutout.test.cjs` (new transparent + settings test) | 9/9; bite (default back to `null`) RED, restored byte-exact |
| `node --test tests/gif-frame-masks.test.cjs` (new) | 2/2; bite (no restore) RED 0/2, restored byte-exact |
| `node --test tests/flow-output-filename.test.cjs tests/text-op-completion.test.cjs` | 5/5 |
| `node --test "tests/*.test.cjs"` | 1297 pass / 0 fail |
| `npm run lint:components` | clean |
| `tests/desktop/gif-cutout.spec.js` (method switch, spinner, sidecar `cutout` + transparent output, masks back on the source entry, a real By colour Cut out with pixel asserts) | 3/4; the 4th passes every step up to BiRefNet and fails there by design: the runner still sends SAM3 params (see below) |

**Blocked:** `js/services/commandExecutor.js` `runGifCutoutTrack` must take `payload.op`. The file is
under MPI-774's claim a4c0f2d7 with that session's uncommitted hunk; message 4463a29e carries the
two-part hunk. Until it lands, Remove background runs the SAM3 graph with an empty prompt.

### Image workspace By colour (worker, integrated ~15:50 local)

`maskColour` sub-tool in Mask > Detect: `MpiToolOptionsMaskColour` (new) + `MpiCanvasViewer`
`setMaskColourMode` / `setMaskColourParams`; the run feeds one pre-picked object into the existing
auto-pick preview, Add/Subtract commit it (undo intact). Review of the worker's first pass: its spec mounted
the viewer by hand and passed while the tool was NOT registered in the Block; the orchestrator added
`maskColour` to `TOOL_OPTIONS_REGISTRY`, `_MASK_TOOLS`, `TOOL_LABELS` and fixed `Number(t) || 16`
(tolerance 0 became 16) in the viewer and the panel. The real-UI respec found `MpiColorPicker` crashing on
`value: null` (the panel never mounted); fixed by omitting `value`.

| Check | Result |
|---|---|
| `tests/desktop/mask-colour.spec.js` (rail -> Colour -> corner `#c8c6c8` -> Detect -> Add -> committed pixels (2,2)=255, (32,32)=0 -> undo -> Tolerance 0 re-runs) | 1/1; worker bite (all-zero mask) RED |
| Desktop: mask-colour, mask-persist-roundtrip, mask-temp-ipc, mask-temp-store, gif-cutout, gif-workspace, history-modes, gif-transform, gif-timing | 14/15; the one failure is gif-cutout's BiRefNet step (`Input_Text_Prompt.text` still sent: runner hunk not landed) |
| `node --test tests/preview-contract.test.cjs tests/colour-key-mask.test.cjs tests/gif-frame-masks.test.cjs tests/gif-cutout.test.cjs` | 25/25 |
| `npm run lint:components` | clean |

Parked with the other typedefs: `MpiToolOptionsMaskColourProps` + its `preloadStyles.js` line (`types-hunk.md`).

### Runner landed (~15:55 local)

MPI-774's claim a4c0f2d7 went `complete` after a7500498, so this session claimed
`js/services/commandExecutor.js` (3c601721) and landed the two-part hunk itself (`payload.op` picks the
graph; BiRefNet gets `Input_Video` only). Message 4463a29e resolved.

| Check | Result |
|---|---|
| `tests/desktop/gif-cutout.spec.js` | **4/4** (BiRefNet step: params `['Input_Video']`, graph contains `RemoveBackground`) |
| `node --test "tests/*.test.cjs"` | 1305 pass / 6 fail. All 6 are MPI-800's in-flight sweeps (`workflow-media-slots`, `flow-required-media`, `flow-model-choice`, test files modified in the tree by that session) listing every `MpiLoadVideo` path loader, `gif_cutout_sam3.json` (committed) included. Not caused here; message d71d7044 asks MPI-800 to migrate `gif_cutout_birefnet.json` with its twin |

**Left:** Fabio's check in his app after a FULL restart (server routes changed); the parked typedef /
preloadStyles lines (`types-hunk.md`); MPI-800 migrating the new graph.

## 2026-09-18 — the 404 closed, three By-colour defects fixed (session 813f42f5)

| Check | Result |
|---|---|
| Root cause of `Media staging failed for Input_Video: HTTP 404` | **Stale server process**, not a code fault. Harness over HEAD's `routes/comfy.js`: missing file -> 404 JSON `media not found`; real file -> 200 `input/mpi_staged/`; unknown route -> 404 **HTML** — the only shape that renders `HTTP 404`. Running main process predated `ee034559`; renderer (served from the tree) did not |
| Fabio's app | booted 17/09 20:49 local, after `ee034559` + `b9f1d756` — no restart needed |
| Remove background / By name in his app | **PASS** (his word, and sidecar `gif_016` `method: birefnet`, 2026-09-18T10:01:13Z). SAM3 uses the identical staging path |
| By colour on an already-cut clip | **FIXED** — real frame measured: 77.7% transparent, corner `#c8c6c8` at alpha 0. No default key colour when the corner is transparent; the tint now shows what By colour REMOVES; `#tint-note` names the tinted side per method |
| Brush-cleared frame could never be re-masked | **FIXED** — `clear()/clearAll()`, `clearFrameMasks()`, **Clear This Frame** / **Clear All** |
| `npx eslint` on the 6 changed js files + 2 tests | clean |
| `node --test` colour-key + gif-frame-masks + gif-cutout + mask-colour + mask-tool-registry | **63/63** |
| `playwright.desktop.config.js` gif-cutout + mask-colour | **5/5** (private `--output` dir) |
| Background tint polarity | **OPEN, not reproducible here.** He reports the tint over the background while the cut kept the robot; `_updateCurrentTint` tints the mask's luma (= what stays) and both graphs emit a foreground mask. No fix invented — one screenshot of the tint settles it |

**Left:** Fabio's check of By colour + Clear + the tint note; the whole-workspace UI list; the parked
typedef / preloadStyles lines (`types-hunk.md`).

## 2026-09-18 — his second pass, items 1-4 (session 78c4c827)

| Check | Result |
|---|---|
| Strip right-click menu | **LANDED.** Delete frame / Clear this frame's mask via `MpiContextMenu.show()` (an Organism may import a Compound). Delete shares `_deleteIndices()` with the Backspace hotkey, so both stage the same edit and the >=1-frame floor holds; it greys out when it would empty the strip, Clear greys out with no mask. Right-clicking inside a Ctrl-click selection acts on the whole selection |
| Trim range on the strip | **LANDED.** `setRange()` dims + greyscales the frames Apply would drop and bars the in/out edges. Fed from the same `range-change` the panel note reads, re-applied after `setFrames`/`commit` (the bar's own `range-change` fires while the strip still holds the PREVIOUS list, so the first paint clamped short) |
| "Every frame still there after Apply" | **EXPLAINED, no code fault.** `timingEdit('trim')` slices correctly and an untouched range ALWAYS hits the toast, so Apply can never write an untrimmed entry — `gif-timing.spec.js` proves a real 1..3-of-6 trim gives a 3-page GIF. He never moved the handles. The note now says **"All N frames are selected — drag the handles"** instead of "Keeps frames 0 to N-1" |
| Gallery hover-play artefact | **ROOT-CAUSED + FIXED.** Static harness over the REAL stylesheets (before/after screenshots in the session scratchpad): the GIF hover overlay inherits the VIDEO overlay's `object-fit: cover` while the poster below is `contain`, and the poster is never hidden. Opaque video = free; a **transparent cut-out GIF** shows the poster through its holes at another scale. CSS only: `--gif` -> `contain`, and `:has()` drops the poster to `opacity: 0`. Removing the overlay un-matches the `:has()`, so no demote bookkeeping. **Caveat: his card was `imported_015` — if that GIF is OPAQUE, this is not his screenshot and it needs another look** |
| `[data-info]` pass | Gaps found and filled: the control bar's **trim handles had no info at all** (the control he could not read) and nor did the frame counter. Everything else already covered. **The tool RAIL is left to him:** its `info` is the floating tooltip text too, so a sentence hangs a paragraph off a 24px icon and every rail in the app is a bare name. Written, seen to break 3 specs selecting `[data-info="Trim"]`, then REVERTED rather than impose a look on his UI |
| Parked registration lines | **LANDED** — `MpiToolOptionsMaskColour.css` in `preloadStyles.js`; new `MpiToolOptionsMaskColourProps`; `MpiFrameStrip` / `MpiGifViewer` / `MpiToolOptionsGifCutout` typedefs rewritten against the code AS IT IS (the 2026-09-16 hunk text predates BiRefNet, By colour and Clear). `types-hunk.md` deleted |
| `npm run lint:components` | clean |
| `npm test` (`node --test "tests/**/*.test.cjs"`) | **1344 pass / 0 fail / 1 skip** |
| Desktop specs (private `--output` dir) | **11 green** — `gif-workspace` **2** (one NEW: right-click delete, the disabled AND live mask clear, the range paint), `gif-cutout` 2, `gif-timing`, `gif-make`, `gif-maker`, `gif-transform`, `mask-colour`, `history-modes`, `gallery-gif-hover` |
| Background tint polarity | **STILL OPEN.** Not reproducible here, nothing invented. One screenshot of the tint right after Background finishes, before CUT OUT, settles it |

**Left:** Fabio's eye pass on items 1-4; his answer on the rail; his tint screenshot. Nothing closes
until he passes the UI (plan verify mode: `user-ux`).

### Fabio's pass, 2026-09-18 ~13:5xZ

| Item | Result |
|---|---|
| Strip context menu | **PASS** ("context menu works") |
| Trim range on the strip | **PASS** ("trim now works, and I like the green indicators") |
| Gallery multi-entry hover | **PASS** ("multi-entries no longer display incorrectly") — so the transparent-poster diagnosis held on his real card |
| Backspace deleting a frame | **FAIL — a real bug.** "Backspace still doesn't delete an item." The 2026-09-18 earlier read (undiscoverable, not broken) was WRONG. The context menu is currently the only working delete |

**Backspace — what is eliminated** (throwaway probe, source in the session scratchpad as
`backspace-probe.js`; it was run as `tests/desktop/zz-backspace-probe.spec.js` and DELETED after, so
it is not in the tree): a REAL `keyboard.press('Backspace')` — not the synthetic `dispatchEvent` every
shipped spec uses — deletes a Ctrl-clicked frame in a clean workspace (5 -> 4) and with the Speed tool
panel open (4 -> 3, `activeElement` = `BODY.page-group-history`). The keydown reaches window
un-prevented; `gif.frame.delete` is `backspace`/DOWN with no `when` gate; the `isTyping` block only
bites for textarea / contenteditable / text inputs, and the strip blurs `activeElement` on pointerdown
anyway. The mechanism is sound — the fault is conditional on something his session has that the
fixture does not. **Bisect before coding: does a Ctrl-clicked thumb show the orange selection ring in
his app?** Ring = hotkey path; no ring = selection path.

### Backspace: root cause, fix, and the proof it was red (2026-09-18, session b3d5499a)

Fabio answered the bisecting question: **the orange ring appears**. Selection was never the
fault, so the hotkey path owned it.

**Root cause.** `hotkeyManager._normalizeKey()` prepends every held modifier, so a Backspace
pressed with Ctrl still down normalises to `control+backspace`. The registry carried exactly one
entry for this action, key `backspace`. `_handle()` looks the handlers up by the normalised key
and returns at `if (!handlers || handlers.size === 0) return;` -- before the registry scan, before
the isTyping gate, before any handler. Nothing fired and nothing logged.

Selecting frames MEANS holding Ctrl. A user who has just Ctrl-clicked four thumbnails still has
Ctrl down when they reach for Backspace, so the documented gesture was the one gesture that could
not work. Every previous elimination passed because each pressed Backspace ALONE: the shipped
specs synthesise a modifier-free event, and the previous probe released Ctrl before pressing.

**Fix.** Three registry ids for one action (the `system.uiZoom.in.plus`/`.equal` idiom already in
that file): `gif.frame.delete` (bare), `.ctrl` (`control+backspace`), `.shift` (`shift+backspace`)
-- shift because `_onUp` accepts shiftKey as a selection modifier too. MpiFrameStrip binds one
shared `_deleteSelection` to all three. No hotkeyManager change: normalising modifiers is correct
for every other binding in the app.

**Proven red first.** `tests/desktop/gif-workspace.spec.js:192` now presses with `ctrlKey: true`.
Against the pre-fix `hotkeyRegistry.js` + `MpiFrameStrip.js` restored from HEAD (copied aside, not
`git stash` -- shared tree), the run FAILED at the thumb-count poll on line 199, 1 failed / 1
passed. With the fix restored, 10/10.

NOT covered by ctrl+shift held together; a corner case no gesture asks for.

### Rail descriptions, and the tint rule (2026-09-18, same session)

**Rail** (Fabio: "everything else says what it does on the status bar. No floating tooltips,
please"). The two channels turned out to be the REVERSE of what the earlier session assumed:
the rail mounts each button inside a `.mpi-history-tools__btn` wrap, its own `mouseover` tooltip
reads the WRAP, and statusBar.js resolves `e.target.closest([data-info])`, which finds the inner
MpiButton and never reaches the wrap. So the sentence goes on MpiButton `info` and the name stays
on the wrap -- the opposite assignment to the obvious one. Every GIF rail entry gained a `desc`;
entries without one fall back to the name exactly as before. All existing spec selectors match
the wrap by name, so none needed changing (the earlier session reported 3 breaking; that was the
other assignment).

**Tint** (Fabio: "It is a cutout, so anything that is masked should go away"). One rule for all
three methods: `flip = !_invert`, the tint is always what GOES. The per-method `#tint-note` badge
is deleted along with the three `tintNote` strings. The mask stays white=KEEP internally --
`applyMaskAlpha` writes it straight into the alpha channel, which is what alpha IS -- so only the
display flipped; no server, sidecar or brush change.

This also CLOSES the open "Background tint over the BACKGROUND while the cut kept the robot"
question with no screenshot needed. It was never a polarity bug: under the old "tinted = what
stays" rule, Background with Invert ON tints the background and keeps it, and Fabio read the tint
the natural way -- as what goes. The rule he asked for makes the reading correct.

**NOT automated:** the tint POLARITY has no assertion. The specs check that a tint is present and
follows its frame, not which side it covers. `flip = !_invert` is one expression with a loud
comment and the rule is stated in docs/masking-sam3-gif.md, but a silent flip back would not fail
a test. Fabio's eye is the gate here (this card is `user-ux`).

**Green:** lint + lint:components clean; `node --test "tests/*.test.cjs"` 1346 pass / 0 fail / 1
skip; desktop gif-workspace + gif-cutout + gif-timing + gif-transform + gif-maker + mask-colour
10/10.

### Scope consolidation + the toast (2026-09-18, session b3d5499a)

Fabio: four buttons (Mask All / Mask This Frame / Clear All / Clear This Frame) become TWO verbs
and a scope, so Selected can exist without a fifth and sixth button.

- `MpiRadioGroup` **All / Frame / Selected** above **Mask** and **Clear**. Scope is UI-only, not
  saved with the settings: it describes this click, not this GIF.
- Selected is the frame strip Ctrl-click set. The strip gained `selection-change
  { indices, viewerIndices }` and `el.getSelection()`; the Block forwards to the panel s
  `el.setSelection(viewerIndices)` and SEEDS it at mount, since a selection can predate the panel.
  VIEWER positions, not staged ones -- masks are keyed by the viewer order, the same split the
  context menu s `clear-frame-mask` already carries.
- Selected is aria-disabled while empty (MpiRadioGroup documents setting that imperatively), and a
  selection that empties hands the live scope back to All.
- `_runTrack` now takes `all` | `{idx,hash}` | `{list:[...]}`. A narrower scope lands frame by
  frame (`setTrackMask`) -- `setTrackMasks` replaces the WHOLE list and is only right for All, so
  using it for a subset would wipe the masks on every frame the run did not touch.
- **Found while building:** MpiRadioGroup paints `is-active` on click before the owner gets a say,
  so a scope click refused by `_busy` left the button showing one scope while `_scope` held
  another. The scope radio now locks with the method radio in `_setBusy` -- same idiom, divergence
  removed at the source. Caught by the new spec, not by review.
- **Toast removed.** `_scheduleRekey` raised "Press Mask All or Mask This Frame" on every paused
  slider drag with nothing keyed yet, which piled up toasts. It is a silent no-op now; the colour
  picker s and the Tolerance slider s `info` carry it on the status bar instead, reworded to
  "Changes are only visible once you press Mask".

**Spec.** `gif-cutout.spec.js` asserts the two verbs, the three scopes, All as the default, Selected
refused while empty, then Ctrl-clicks two thumbs through the strip s OWN pointer handlers
(`ctrlClickThumb`), asserts Selected un-disables, picks it, toggles the thumbs back off and asserts
the scope returns to All. It runs BEFORE the Track dispatch: a run in flight locks the scope radio
and turns Mask into Stop, so only one dispatch is checkable per test. What a narrower scope
DISPATCHES is covered by test 2 s Frame-scope run -- the same `picked` path.

**Green:** lint + lint:components clean; `node --test "tests/*.test.cjs"` 1348 pass / 0 fail / 1
skip; desktop gif-workspace + gif-cutout + gif-timing + gif-transform + gif-maker + mask-colour
10/10.

### Mask display consistency - INVESTIGATED, not built (Fabio asked 2026-09-18)

His ask: the image workspace lets you change the mask white/black, control opacity and view just
the mask -- do the same here. What is actually true:

- `MpiMaskStrip` (Compound) is the shared bottom strip of every image mask tool: paint/erase,
  invert, **B/W view**, clear, **opacity**, brush presets. Settings live under the `mask` tool key.
- **The GIF Mask Brush ALREADY MOUNTS IT.** `MpiToolOptionsMaskBrush` mounts
  `MpiMaskStrip({ viewer, brush: true })` and `MpiGifViewer` already implements the whole API it
  needs (`setMaskInverted`, `setMaskBwView`, `setMaskOpacity`, ...). So the editable mask layer in
  the GIF workspace is already the image one, controls included.
- **The gap is the CUT-OUT TINT**, which is a different object: a read-only preview overlay
  (`.mpi-gif-viewer__mask-tint`, plus per-thumb tints on the strip), `--accent-heat` at a FIXED
  0.45 opacity with `mask-mode: luminance`. No opacity, no B/W, no colour, because it was built as
  a preview of a computed mask rather than as a layer being edited.

So this is not "make the GIF masks like the image ones" -- it is "give the cut-out PREVIEW the same
display controls as an editable mask layer". Needs his call on scope before building.

### The mask is one colour everywhere now (2026-09-18, session b3d5499a)

Fabio, on the tint: *"Why is one pink and the other one black or white with options? I am not
saying why in the code. I am saying why for the user."* He is right, and the answer was in
`MpiCanvas`:

- `MASK_AUTO_FILL = oklch(0.78 0.13 150)` (identical to `--accent-ok`) is what the IMAGE canvas
  paints a mask that came from a DETECT RUN. Hand-painted is white, inverted is black
  (`MASK_INVERT_FILL`), B/W view is white on black. So "green while it is being changed, then
  white or black" is exactly the image workspace, described from the outside.
- A SAM3 / BiRefNet / colour-key mask is the SAME CONCEPT: an auto-produced mask, ready to cut.
  It was wearing `--accent-heat` at 0.45 purely because it was built as a preview overlay rather
  than as a mask layer.

So both tint surfaces moved to `--accent-ok` at 0.7 (MpiMaskStrip DEFAULTS.opacity), on the
viewer (`.mpi-gif-viewer__mask-tint`) and on every strip thumbnail
(`.mpi-frame-strip__thumb-tint`). CSS + the doc line only; no logic touched.

**Still NOT at parity, and it is structural:** the strip B/W view / invert / opacity slider drive
`MpiCanvas` through `viewer.el.setMaskBwView()` etc. Outside the Mask Brush there IS no canvas —
the Cut-out preview is a CSS overlay on an `<img>`. Giving it those toggles means either
reimplementing them on the overlay or routing the cut-out preview through the canvas path. Not
built; needs Fabio.

**Also:** both `MpiRadioGroup` pickers (method, scope) now span the panel at MpiButton `sm` padding
(8px 14px). Scoped through a `__picker` class in the panel stylesheet, not the shared primitive.

**Green:** lint + lint:components clean; desktop gif-cutout + gif-workspace 6/6.

## 2026-09-19 - Fabio's SECOND pass (session `5e86d76c`)

Five items, all built. Four carry a guard; the fifth is panel order.

**Automated:**
- `npm run lint:components` - clean.
- `node --test "tests/*.test.cjs"` - 1409 tests, **1408 pass, 0 fail**, 1 skipped.
- `npx playwright test tests/desktop/gif-workspace.spec.js tests/desktop/gif-cutout.spec.js`
  - **9 passed, 1 failed.** The failure is `gif-cutout.spec.js:446` ("real Track dispatch"),
  the peer frame-store bug already filed as `077abd3b` / `922a3667`. **Re-proven not ours:**
  it fails identically with all six of this session's source files swapped back to `HEAD`.

**Each guard proven RED on the pre-fix file** - a guard that passes under the bug is not a
guard, and this card has been bitten by that three times. One file at a time, via `git show
HEAD:<file>`:

| Reverted | The assertion that failed |
|---|---|
| `MpiFrameStrip.js` | `Shift must take the whole run from the anchor` - got `['3']`, wanted `['0','1','2','3']` |
| `MpiMaskStrip.js` + `projectService.js` | `the Mask Brush must inherit the invert Cut-out just set` - false |
| `MpiGifControlBar.js` | `Space must play in Cut-out` - false |
| `_setTint`'s body only | `the hidden tint must keep mask-mode: luminance through the fade` - false |

**Item 4 is asserted on a DOM invariant, not on a pixel**, deliberately: the flash is a CSS
opacity transition running with the wrong `mask-mode`, which no spec can catch in the act. What
it asserts is the state the flash comes FROM - a hidden tint that still carries `--luma` and its
bitmap.

**One existing spec was changed, not just added to.** `gif-cutout.spec.js:1151` asserted
*"Space must not play in Cut-out - it pans"*. That is the exact rule item 5 reverses, on Fabio's
word, so it now asserts the narrowed one: the Mask Brush keeps Space (it paints on a bare drag),
Cut-out plays with it (`brush: false`, so `InputController`'s final `else` already pans there).

**STILL OPEN: Fabio's eye pass on the whole workspace.** Nothing here closes without it. The
automated evidence above says the code does what he asked for; it does not say the workspace
feels right, and four of these five are things only he can judge.

**CI GREEN, and it carries this commit.** `5f96c76d` ("Fabio's second pass - five items on the
GIF workspace") is an ancestor of `188cdc78`, and run **35453767615 on `188cdc78` passed**. So the
second pass has a green run of its own code, not just a green local box.

**The red master this session met, and did NOT fix.** `.husky/pre-push` blocked the push:
`agent-chat.spec.js:645`, `textShare` 0.6081 against a 0.65 bar, introduced by MPI-774's pinned
settings cog narrowing the run column. Diagnosed to that line, then stopped, for two reasons:
`MpiPromptBox.js`/`.css` were under a LIVE claim (`450b7f35`, 26-minute heartbeat), and the
number is a design judgement on another card's UI, not a mechanical fix. Its owner had already
fixed it in `188cdc78` ("textShare measured the WINDOW, not the layout"). A peer's push then
carried `5f96c76d` up with it, so nothing here was pushed around the red.

One thing worth keeping: **`gif-workspace.spec.js:369` appeared in the first red run and was a
FLAKE** - it failed once and passed on retry #1, and the next run has it green. It is not a
second bug hiding under the agent-chat one.

## 2026-09-19 - Fabio's THIRD pass (session `5e86d76c`)

Two items, both built, both guarded.

**1. Double-click back to fit.** `InputController`'s dblclick was gated on `!mask.isMaskingMode`
- the same too-broad gate Space had. A mask mode that does not paint (`brush: false`) leaves the
pointer to the view, so the gesture is the view's. Now gated on `mask.paintEnabled`. Wider than
this card: the image workspace's Detect / Points / Text / Adjust / Composite could not
double-click to fit either, and now can.

**2. The mask display.** Worth recording that THE REPORTED SYMPTOM WAS NOT THE BUG. "The invert
toggle does not carry" is false - `opacity`, `inverted` and `bwView` are identical across the
tool switch, measured on the canvas, in all four directions, with and without a mask present.
What does not carry is the picture: the store holds "what stays", Cut-out displays `255 - alpha`
so the highlight marks what GOES (Fabio's own rule, 2026-09-18), and the Mask Brush displayed the
raw mask. Same frame, complementary regions.

The fix is a missing PRIMITIVE, not a patch on either tool: `MpiCanvas.displayComplement` draws
the same layers inside-out. `displayInverted` only ever recoloured the mask region black, which
is precisely why Cut-out had to be given a pre-flipped bitmap and why nothing could be painted on
top of it. `MpiGifViewer` owns the flag so both tools share it, and swaps paint/erase under it so
a stroke grows the region under the cursor. **The store is untouched** - the brush still holds
its real manual/subtract layers and saves them back unchanged, which is what keeps this clear of
the `_editIdx` trap that reddened master earlier today.

**Measured, not eyeballed.** Two screenshot passes were inconclusive because the fixture colours
washed out; the answer came from sampling the overlay's alpha per region. That is also what
caught a regression the first attempt shipped: Cut-out complementing its already-flipped override
and landing back on what stays. Reading the code would not have found it.

| Reverted to HEAD | The assertion that failed |
|---|---|
| `InputController.js` | double-click: the scale stayed at 51 |
| viewer + canvas + mask manager + cut-out panel | `the brush must highlight the SAME region Cut-out does` - brush `{disc:true}`, Cut-out `{background:true}` |

**Automated:** `lint:components` clean; `node --test "tests/*.test.cjs"` 1419 pass / 0 fail; full
desktop suite 134 passed / 4 failed - three the known peer frame-store bug (gif-cutout:446, gif-timing:73, gif-transform:56) and the fourth a live peer's in-flight uncommitted gallery work (claim 3f8e2d51 holds MpiGalleryGrid + gallery-filter-panel.spec.js; it passes in isolation).

**STILL OPEN: Fabio's eye pass on the whole workspace.** Nothing here closes without it.

## 2026-09-19 ~18:55Z (session `eb575dd3`) - the stroke bug, and the playing tint that was "unproven"

**Fabio's screenshot, reproduced before any code was read.** New spec "a brush stroke ACROSS the
subject edge..." strokes from the background into the disc and samples four points on three
surfaces. First run: brush overlay and STORE both said "goes" on both sides of the edge; Cut-out's
overlay said `strokeInBackground: false, strokeInDisc: false` - his untinted hole with the subject
untouched, exactly. So the store was never wrong and none of the plan's three candidates was it.

**Root cause (measured: `getSubtractURL()` non-null on Cut-out's canvas).** Brush -> Cut-out
remounts the canvas; the mount's `_loadEditFrame` runs before Cut-out's first preview exists,
takes the normal branch and loads base + manual + subtract; `setCutoutPreview()` then swapped only
the base. The override is composed and flipped already, so the brush's `subtract` (a Paint stroke
under the flip) was applied a second time and erased the stroke out of the tint. Fix in
`MpiGifViewer.js`: the first override after a mount or Clear reloads through `_loadEditFrame`'s
override branch, and `_loadEditFrame` is serialised so a superseded load's late layer decode cannot
land on the next load's canvas.

**The "unproven" playing tint WAS broken.** New spec "PLAYING in the Mask Brush..." reads a
screenshot of the tint box (lighter region = highlighted): past the first playing frame the
highlight sat on the DISC. `_render()` fed later frames the raw store mask. Fix: `_setPlayingTint()`
+ a CSS-only complement (`--complement`: solid second mask layer, `mask-composite: exclude`).

| `MpiGifViewer.js` put back to HEAD (sha-verified restore) | The assertion that failed |
|---|---|
| stroke spec | `Cut-out must show the brush stroke as "goes"` - both stroke points `false` |
| playing spec | `highlighted: "disc"`, expected `"background"` |

**Automated, with the fix:** eslint clean on both files + `lint:components` clean;
`node --test` over every gif / mask / colour-key suite 145 pass / 0 fail; desktop `gif-workspace`
(10) + `gif-cutout` + `gif-make` + `gif-maker` + `mask-colour` + `gallery-gif-hover`: **18 passed /
1 failed**, the one being `gif-cutout.spec.js:446` - the known peer frame-store bug, re-proven not
ours here: it fails identically with HEAD's viewer in place.

**Not automated:** the wrong-way flash in Cut-out while PLAYING (the raw store mask shown for a
beat before the panel's preview landed) is removed by construction, not asserted - a per-frame
flicker is not samplable without racing playback.

**STILL OPEN: Fabio's eye pass**, now including: stroke across an edge in the Mask Brush -> open
Cut-out -> the stroke must be tinted, no hole; and Play in the Mask Brush must keep the tint on
the background.

**VERIFIED BY FABIO, 2026-09-19 ~19:00Z, in his own app:** "it's verified. It looks good." This is
the evidence that closes MPI-771; it stays `doing` tonight only because the session ended in a
handoff (agent access to the GIF workspace is the next job, see the umbrella plan).
