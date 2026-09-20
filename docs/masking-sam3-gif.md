# GIF cut-out — BiRefNet, SAM3 by name, and by colour (MPI-771)

Split out of [masking-sam3.md](masking-sam3.md) at MPI-771's UI half, when a second
detector branch pushed that doc past 200 lines. Read that file first for the model,
the click-point and open-vocabulary text tools, and the `name:N` count trap
(`js/utils/maskTextPrompt.js`) this branch reuses unchanged. Related:
[gif.md](gif.md) (the frame store, `gif` sidecar field) and
[masking.md](masking.md) (layer model and undo; the Mask Brush below adds a BASE layer to it).

## The graph — `comfy_workflows/raw/gif_cutout_sam3.json` / `gif_cutout_sam3.json`

Same checkpoint (`sam3.1_multiplex_fp16.safetensors`), its **video tracker** instead
of the single-image detector (op `gifCutoutSam3`, agent-authored with Fabio's
explicit permission, 2026-09-15 — the one exception to "the user edits workflows,
the agent syncs"):

```
MpiLoadVideoUpload (Input_Video, ONE video frame per GIF frame, E7 in the MPI-757 plan)
  -> SAM3_VideoTrack (images + Input_Text_Prompt conditioning from the SAM3
                       checkpoint's own CLIP)
  -> SAM3_TrackToMask (Input_Object_Indices) -> Output_Mask
  + SAM3_TrackPreview -> Output_Preview
```

`Output_Mask` is one mask image **per frame**, same order as the input video —
**no per-object output.** `Output_Preview` is a numbered debug video; since SAM3's
video tracker has no per-object mask, this is the ONLY way a human (or a UI) learns
which tracked index is which object.

- **`Input_Object_Indices` needs the DOTTED injection form** — `'Input_Object_Indices.object_indices'`
  (MPI-359), exactly like `'Input_Text_Prompt.text'`; a bare `Input_Object_Indices` key
  silently sets nothing.
- **Re-dispatching a different `object_indices` is CHEAP.** ComfyUI caches
  `SAM3_VideoTrack` by its own inputs; changing only the downstream `SAM3_TrackToMask`
  widget re-executes just that node, not the tracker — the opposite of MPI-421's SEGS
  picker (removed because a chip toggle re-ran the whole detect). The UI tool group
  below re-dispatches per chip toggle instead of needing a client-side OR of
  pre-fetched per-object masks, because that redispatch is free.
- **`max_objects` / `detection_threshold` / `detect_interval` are fixed graph literals**
  (4, 0.5, 1 — `detect_interval: 1` tracks every frame, per "less flicker"), not
  app-injected. `max_objects: 4` is why the UI's chip row is a fixed 4 slots, not a
  count derived from the run.
- **Runner:** `runGifCutoutTrack()` beside `runAutoMask` (`js/services/commandExecutor.js`)
  — both engines run the identical graph through `getEngine(forceLocal)`, no
  local-only shortcut. Live-verified 2026-09-16 on a real 30-frame extract of a real
  mascot clip with the bare text prompt `"robot"`: 30 masks back for 30 frames, each a
  clean silhouette.
- **`routes/gifCutout.js`** (not `routes/gif.js`'s `POST /gif/entry`) owns everything
  else non-GPU: `POST /gif-cutout/source` builds the temp track video this runner
  needs (E7) and `POST /gif-cutout/apply` bakes the returned masks into each frame's
  alpha and lands a new entry. Full request/response contracts, the codec choice and
  the flatten-before-encode reasoning are in that file's own header comment.

## Mask methods (plan Decision 15, 2026-09-17)

Fabio's UI pass found SAM3's "Background" mask ragged at the frame edge and slow to fix by
hand, so Cut-out has three METHODS that all fill the same per-frame track layer (so the brush,
Adjust, Invert and Cut out work unchanged). Every mask is white = KEEP.

- **Remove background** (default) — op `gifCutoutBirefnet`, `gif_cutout_birefnet.json`:
  `MpiLoadVideoUpload (Input_Video) -> RemoveBackground (the shipped `birefnet` engine asset, the
  same nodes as the image op `removeBackground`) -> MaskToImage -> Output_Mask`. No prompt, no
  preview, no chips. Same runner (`runGifCutoutTrack({ op })`), video in, one mask per frame.
  Measured on the 8188 bench 2026-09-17: 30 masks for Fabio's 320px robot in 16 s, ~4 GB VRAM.
  `MpiLoadVideoUpload` reads only inside ComfyUI's input/output/temp folders, so a hand probe must
  stage its video there (the app's staging already does).
- **By name** — the SAM3 graph above.
- **By colour** — no engine: `js/utils/colourKeyMask.js` keys each frame in the renderer
  (largest per-channel difference <= Tolerance, default 16; "Only touching the edges" flood-fills
  from the border so an enclosed same-colour patch stays). The key defaults to the current
  frame's top-left pixel and is never saved (it belongs to one GIF); **Pick** is Chromium's
  native `EyeDropper`. A Tolerance / edges / colour change re-keys the last scope after 250 ms.
  On Fabio's robot, 16 kept the face; 32 started eating it.
  A TRANSPARENT top-left pixel gives NO default (`cornerColour()` returns null): its RGB is
  whatever an earlier cut hid — a real 320x320 cut reads `#c8c6c8` there — so keying it would
  remove a colour nobody can see and eat the subject's dark outline at any tolerance. The run
  asks for a Pick instead (MPI-771, 2026-09-18).

Every frame of an ALREADY-CUT clip is mostly alpha 0 and `keepMask` keys every transparent
pixel out, so the mask is "the opaque subject" before the colour is weighed — the keep side
barely moves as Tolerance is dragged, which is why tinting the keep side read as a dead slider.

**Every method tints WHAT GOES AWAY** (`flip = !_invert` in `MpiToolOptionsGifCutout`). It is a
cut-out: the masked area is the area that disappears, so the tint says whether Invert is needed
without a caption. This replaced a per-method `#tint-note` that said "stays" for two methods and
"goes" for the third — one rule everywhere beats a label explaining an exception (Fabio,
2026-09-18). The mask itself stays white=KEEP internally, because `applyMaskAlpha` writes it
straight into the alpha channel; the tint is the complement of whatever survives `Invert`.

**And the MASK BRUSH follows it** (Fabio, 2026-09-19). The rule is the workspace's, not
Cut-out's: with `Invert` off, Cut-out highlighted the background while the brush highlighted the
subject, so the brush asked you to clean up the region you were not looking at. `MpiGifViewer`
now owns the flip — Cut-out pushes `setMaskDisplayFlip(!invert)` on mount and on every change,
and the brush renders `MpiCanvas`'s `displayComplement` (see [masking.md](masking.md)) rather
than a flipped bitmap, so it still holds the REAL layers and saves them back untouched. Three
things that are easy to get wrong here:

- **Cut-out must NOT complement.** Its override is flipped already, and two flips are a no-op —
  which is exactly the regression the first attempt shipped. `setCutoutPreview()` clears the
  flag as well as `_editIdx`, because the mount runs before the first preview arrives and has
  already taken the normal branch.
- **...and that normal branch loaded the BRUSH LAYERS too.** The override is composed already,
  so a `subtract` left on the canvas is applied twice: a brush stroke read "goes" in the brush
  and came back in Cut-out as an untinted hole. The FIRST override after a mount (or a Clear)
  therefore reloads the frame through `_loadEditFrame`'s override branch (`loadImage()` wipes
  every layer); later ones only swap the base. `_loadEditFrame` is SERIALISED for the same
  reason — a superseded load's late layer decode must not land on the next load's canvas.
- **Paint and erase SWAP under the complement.** The canvas paints the inverse of what is on
  screen, so "Paint" is wired to the eraser and back. The strip's radio is untouched: from the
  user's side it is still painting, and the stroke still grows the region under the cursor.
- **The flip is decided per frame VISIT, and only when the frame already has a mask.** The
  complement of nothing is the whole frame, so a brush used to paint a mask from scratch would
  open on a solid sheet of tint; deciding it mid-stroke would be worse. The brush is mostly for
  cleaning up a mask that exists, and that case gets the shared rule.

## The two tools — Cut-out and Mask Brush (MPI-771, plan Decision 14)

A track is a STARTING POINT: object numbers need not stay the same object from frame to
frame, so the user fixes frames by hand. The `gif` rail's Cut-out group
(`Compounds/MpiHistoryTools` `GIF_TOOLS`) therefore holds two modes, and the masks live on
the VIEWER so both reach them.

### Where the masks live — `MpiGifViewer` + `gifFrameMasks.js`

Per frame POSITION, because a track comes back per position: `track` (engine URL), `edits`
(the brush's manual/subtract layers as working-res alpha PNGs) and `composed` (the greyscale
PNG the canvas exported when the edits were saved). **`composed` keeps COVERAGE — it is
exported with `getURL('black', 'white', true)`, never the binary form** (MPI-835). An engine
mask's soft falloff IS its edge, and `applyMaskAlpha()` reads luma as alpha; the binary export
(any alpha = white, image mode's inpaint contract) grew a brushed frame's WHOLE mask by the
feather width — 3.3% more area on a real BiRefNet frame — so one brush fix put a halo round
every object in that frame while its untouched neighbours stayed clean (Fabio, 2026-09-20).
A test mask must be SOFT to see this: hard black/white agrees under both exports. A mask still describes its own frame's
pixels, so a staged strip reorder, delete or Discard CARRIES the masks along: the strip's
`'stage-change'` sends `order` (each new position's old one), the Block passes it to
`setFrames(frames, order)`, and `remap()` rebinds the store. Update/Apply then reload the same
list, so the signature matches and nothing is lost (Fabio lost every fix to one stray drag
before this). A different list STASHES the masks by its signature (8 lists, session only) and
restores that list's own: after Cut out, going back to the source entry brings its masks back
with no re-track (Fabio, 2026-09-17). A list change with no `order` stashes them and the
Block toasts. `getCutMasks()` sends the track URL for an untouched frame, the composite for a
brushed one, and a 1x1 WHITE PNG for a frame with neither, so an untouched frame comes
through unchanged (black there meant "nothing kept", and masking ONE frame then cutting
produced an EMPTY GIF — Fabio, 2026-09-18; `applyMaskAlpha()` resizes a mask to
its frame). A re-track replaces TRACKS only (Fabio: brush fixes survive); a brushed frame's
composite is then stale and is rebuilt through a headless `MaskManager`, so there is ONE
compositor. Because they survive, **clearing a mask with the brush is not clearing it**: the
brush writes a full-frame `subtract`, which then eats every later re-mask, so that frame reads
as unmaskable. `clearFrameMasks('all' | idx)` is the only real clear — it drops `track`,
`edits` and `composed`, and wipes the live canvas when the cleared frame is the one open in
the brush (the panel's **Clear**, MPI-771, 2026-09-18). The viewer emits `masks-change { overlay, edited, cleared }`; the Block feeds
`MpiFrameStrip.el.setMaskOverlay(overlay, edited)` (tint + a dot on brushed frames) and the
Cut-out panel's `onMasksChange()`.

### Mask Brush — mode `gifMaskBrush`

The image-mode `MpiToolOptionsMaskBrush`, unchanged: `MpiGifViewer` implements its
`enterMode('mask')` / `exitMode()` and the whole `MpiMaskStrip` surface. `enterMode` mounts an
`MpiCanvas` over the stage holding the current frame, its track as the BASE layer
([masking.md](masking.md)) and its brush layers; stepping frames saves and reloads, keeping a
zoomed view and the brush size. The GIF preview is off while it is up: the viewer emits
`'edit-change'` and the control bar disables its preview button. That event also carries
`ownsDrag`: **Space plays in Cut-out and pans in the Mask Brush.** `canvas.pan.start` and
`video.playPause` are two hotkey ids on one key, so the control bar has to stand one down —
but only where the tool takes a plain left-drag. The Mask Brush and Crop do, and hold-Space is
their only pan; Cut-out mounts the strip with `brush: false`, so `InputController`'s final
`else` already pans on a bare drag and Space is free. `ownsDrag` re-fires on
`setMaskPaintEnabled`, because the strip mounts after `enterMode`. **Play** hides the
canvas (`visibility`, so its view survives) and plays the plain frames under their mask tint,
a flicker check; pause brings the canvas back on the current frame. Undo is per frame visit
(`loadImage` clears the stack). Its own mode, not `maskBrush`: that one is in the Block's
`_MASK_TOOLS` and drives image-canvas bridges. The brush works with no track at all (paint a
mask from scratch). Under `gifMaskBrush` the panel shows a note that the fixes are baked by
Cut-out; Fabio chose that over a second Cut out button (2026-09-16).

### Cut-out — `MpiToolOptionsGifCutout`

0. **Method** — `MpiRadioGroup` (Remove background / By name / By colour), saved as
   `toolSettings.gifCutout.method`; the hint, the name field and the colour controls follow it.
1. **Scope + Mask / Clear.** An `MpiRadioGroup` of **All / Frame / Selected** names who the two
   verbs act on; Selected is the frame strip's Ctrl-click set, which reaches the panel as
   `el.setSelection(viewerIndices)` (the Block forwards the strip's `selection-change`, and
   seeds it at mount) and is aria-disabled while empty. Four buttons collapsed to two so
   Selected could exist without a fifth and sixth (Fabio, 2026-09-18).
   `runGifCutoutTrack({ op })` is called from the panel; a narrower scope is the same
   graph on a source video of just those frames, and lands frame by frame (`setTrackMask`)
   so untouched positions keep the masks they had — `setTrackMasks` replaces the whole list
   and is only right for All. A run spins
   the viewer (`setGenerating`) and drives the status bar directly (indeterminate clock,
   `complete()` when masks landed, `cancel()` otherwise), the image Detect row's idiom. There is **no count input**: each name is stamped `name:4`, the same 4
   as the chips (`OBJECT_SLOTS` = `max_objects`), because a bare name finds ONE object
   ([masking-sam3.md](masking-sam3.md) § the `name:N` trap). Source videos are cached per
   frame signature. Results that land after the frame list changed are dropped.
2. **Read the preview** (`Output_Preview`, via `MpiVideoSurface`) for which index is which.
3. **Chips** — 4 checkboxes, default all kept. A toggle re-dispatches the LAST scope (all,
   or that one frame) with the cached video — cheap, per the graph note above. `''` when all
   are kept; at least one must stay checked (`''` means "keep everything" server-side).
4. **Mask Adjust (Grow/Shrink) + Fill Holes + Invert**, set once for every frame, shown when
   any frame has a mask. Grow/Shrink previews LIVE on the current frame with the same
   `managers/distanceField.js` functions `applyMaskAlpha()` runs, over
   `viewer.el.getFrameMaskURL(idx)` (a small LRU of decoded masks and fields; composed masks
   are data URLs). Fill Holes has no preview. All three persist in `toolSettings.gifCutout`
   beside `textPrompt`, so a trip to the Mask Brush does not reset them.
5. **The shared `MpiMaskStrip`** (`brush: false`), at the bottom, exactly as Detect / Points /
   Text mount it — opacity, invert display, B/W view, clear. See § Tints for why it needs the
   canvas and what the display override is doing. Hand-fixing a frame is still the Mask
   Brush's job, one rail button away.
6. **Cut out** — `viewer.el.getCutMasks()`, then emits `{ frames, masks, adjust, invert,
   settings }`; the Block posts `/gif-cutout/apply` and appends the entry
   (`_handleGifCutoutApply`), never through `/gif/entry`. The route ALWAYS builds transparent
   (`edgeColour` defaults to black: the source entry's output is usually opaque, which
   flattened every cut pixel onto black) and stamps `settings` + adjust/invert as the
   sidecar's `cutout` field.

### Tints

- `'mask-tint' { url }` — the current frame's ADJUSTED mask as white-with-alpha →
  `MpiGifViewer.el.setCutoutPreview(url)`.
  **Since the MPI-771 consistency audit (Fabio, 2026-09-19) Cut-out is a CANVAS tool.** It was
  the only mask-producing tool in the app with no opacity / invert / B-W / clear, and the
  reason was never the mask — those are methods on `MpiCanvas`, which `MpiGifViewer` funnels
  through `_canvas?.`, and Cut-out painted a CSS overlay instead of mounting one. It now calls
  `enterMode('mask')` and mounts the SAME `MpiMaskStrip({ viewer, brush: false })` that the
  Mask Brush and every image mask tool mount. Two consequences worth knowing: the built-`.gif`
  preview toggle is disabled in Cut-out, exactly as in the Mask Brush (a canvas tool works on
  FRAMES, and the built file would cover the canvas); and the stage shows one frame at a time
  unless you press Play, which swaps to the frame-wrap under the tint as it always did.
  `setCutoutPreview` is a DISPLAY OVERRIDE, not a layer: it replaces the bitmap the canvas
  shows and drives the CSS tint during playback, so play/pause never changes what the
  highlight means. `getFrameMaskURL()` / `getCutMasks()` read the real store and never see it,
  and `brush: false` means nothing can write it back.
  The override exists because the canvas can only draw the mask REGION — `setMaskInverted`
  recolours it black (`MASK_INVERT_FILL`), it is not a geometric complement — so showing "what
  disappears" means handing the canvas the already-flipped bitmap. The strip's Invert then
  flips the view back to the raw mask, which is exactly what its tooltip says it does.
  The strip's **Clear** is routed to `clearFrameMasks(index)` under the override: with
  `brush: false` there is no layer to erase with, so clearing only the canvas would repaint
  from a store that still holds the mask and read as a dead button.
  Play in the Mask Brush drives the same div with the store's B/W masks under `--luma`
  (`mask-mode: luminance`). The store is "what stays", so under the flip `_setPlayingTint()`
  adds `--complement`: a solid second mask layer XORed in CSS (`mask-composite: exclude`), no
  per-frame decode. Without it the highlight swapped sides one frame into playback.
  **The tint is WHITE because the mask is COMMITTED.** `MpiCanvas` recolours only its PENDING
  layers to `MASK_AUTO_FILL` (`--accent-ok`): a detect run still waiting on Add / Subtract, or
  an Adjust preview waiting on Apply. A committed mask is `maskColor` — white — drawn straight
  off `maskCanvas`. Mask / Mask all / Mask selected do not propose anything, they WRITE the
  frame's mask and the brush edits it from there, so the cut-out tint is the committed kind
  (Fabio, 2026-09-19). It ran as `--accent-ok` for one day on the opposite reading; that was
  wrong, and the rose it replaced was wrong too. Opacity stays 0.7, the mask tools' default.
  The per-thumb tints on `MpiFrameStrip` match; that strip's `--edited` dot and trim-range bars
  stay `--accent-ok`, being status marks rather than masks.
- Behind the frame, `.mpi-gif-viewer__checker` draws a checker sized to the frame's own
  letterboxed box (`--frame-ar` from the img's natural size, container query units), so a
  transparent pixel never reads as a black fill.
- The strip tint uses `mask-mode: luminance` (engine and composed masks are opaque B/W) and
  `cover` sizing to match the thumb's `object-fit: cover`.
- Mask URLs from the engine are cross-origin; reading their pixels (tint, base layer) relies on
  ComfyUI running with `--enable-cors-header`, which the app sets (`routes/comfy.js`).

## Temp source video — no cancel hook (decision, MPI-771 UI half)

`POST /gif-cutout/source` writes one temp `.mkv` per Track dispatch under
`Media/.gif-cutout-tmp/`, self-swept (any file over an hour old) at the START of
the next `/gif-cutout/source` call in that project. **Decision: the UI adds no
explicit cleanup on leaving the tool/workspace.** The worst case — a user Tracks
once then abandons the tool without Cutting out — leaves at most one orphaned file,
reclaimed within an hour by either the self-sweep or the very next Track (by anyone,
in that project). No precedent in the app adds a leave-hook for a session-scoped tool
temp file either (`docs/masking.md`'s mask TEMP PNGs are explicitly session-scoped
and only swept on app restart, never on leaving a tool). `runGifCutoutTrack`'s own
`exec.cancel()` IS wired to the panel's `destroy()` — that interrupts a RUNNING
ComfyUI job on tool-switch, a separate concern from the temp file's disk lifetime.
