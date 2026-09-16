# SAM3 GIF cut-out — video tracking by name (MPI-771)

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
MpiLoadVideo (Input_Video, ONE video frame per GIF frame, E7 in the MPI-757 plan)
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

## The two tools — Cut-out and Mask Brush (MPI-771, plan Decision 14)

A track is a STARTING POINT: object numbers need not stay the same object from frame to
frame, so the user fixes frames by hand. The `gif` rail's Cut-out group
(`Compounds/MpiHistoryTools` `GIF_TOOLS`) therefore holds two modes, and the masks live on
the VIEWER so both reach them.

### Where the masks live — `MpiGifViewer` + `gifFrameMasks.js`

Per frame POSITION, because a track belongs to a position: `track` (engine URL), `edits`
(the brush's manual/subtract layers as working-res alpha PNGs) and `composed` (the B/W PNG
the canvas exported when the edits were saved). The whole store is tied to the frame list's
signature: a strip reorder/delete empties it (the Block toasts), a different entry does too
(silently). `getCutMasks()` sends the track URL for an untouched frame, the composite for a
brushed one, a 1x1 black PNG for a frame with neither (`applyMaskAlpha()` resizes a mask to
its frame). A re-track replaces TRACKS only (Fabio: brush fixes survive); a brushed frame's
composite is then stale and is rebuilt through a headless `MaskManager`, so there is ONE
compositor. The viewer emits `masks-change { overlay, edited, cleared }`; the Block feeds
`MpiFrameStrip.el.setMaskOverlay(overlay, edited)` (tint + a dot on brushed frames) and the
Cut-out panel's `onMasksChange()`.

### Mask Brush — mode `gifMaskBrush`

The image-mode `MpiToolOptionsMaskBrush`, unchanged: `MpiGifViewer` implements its
`enterMode('mask')` / `exitMode()` and the whole `MpiMaskStrip` surface. `enterMode` mounts an
`MpiCanvas` over the stage holding the current frame, its track as the BASE layer
([masking.md](masking.md)) and its brush layers; stepping frames saves and reloads, keeping a
zoomed view and the brush size. Playback and the GIF preview are off while it is up. Undo is
per frame visit (`loadImage` clears the stack). Its own mode, not `maskBrush`: that one is in
the Block's `_MASK_TOOLS` and drives image-canvas bridges. The brush works with no track at
all (paint a mask from scratch).

### Cut-out — `MpiToolOptionsGifCutout`

1. **Track All / Track Single Frame.** `runGifCutoutTrack` is called from the panel; the
   single-frame run is the same graph on a one-frame source video, and replaces only that
   position's track. There is **no count input**: each name is stamped `name:4`, the same 4
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
   are data URLs). Fill Holes has no preview.
5. **Cut out** — `viewer.el.getCutMasks()`, then emits `{ frames, masks, adjust, invert }`; the
   Block posts `/gif-cutout/apply` and appends the entry (`_handleGifCutoutApply`), never
   through `/gif/entry`.

### Tints

- `'mask-tint' { url }` — the current frame's ADJUSTED mask as white-with-alpha →
  `MpiGifViewer.el.setMaskTint(url)`: an `--accent-heat` div clipped by CSS `mask-image`,
  `contain` + centred, because the wrap is full height and a short frame sits letterboxed in it.
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
