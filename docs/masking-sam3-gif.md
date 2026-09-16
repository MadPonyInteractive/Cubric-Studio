# SAM3 GIF cut-out — video tracking by name (MPI-771)

Split out of [masking-sam3.md](masking-sam3.md) at MPI-771's UI half, when a second
detector branch pushed that doc past 200 lines. Read that file first for the model,
the click-point and open-vocabulary text tools, and the `name:N` count trap
(`js/utils/maskTextPrompt.js`) this branch reuses unchanged. Related:
[gif.md](gif.md) (the frame store, `gif` sidecar field) and
[masking.md](masking.md) (layer model, undo — neither applies here, see below).

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

## The tool group — `MpiToolOptionsGifCutout` (MPI-771 UI half)

One panel in the `gif` history mode's rail (`Compounds/MpiHistoryTools` `GIF_TOOLS`,
mode `gifCutout`), reached because per-object masks do not exist server-side:

1. **Track** — name the object (+ count, stamped `name:N` the same way the text
   detector reads it), dispatch once with `objectIndices: ''` ("keep everything").
   `runGifCutoutTrack` is called directly from the panel — it only needs
   `state.currentProject.folderPath` and `viewer.el.getFrames()`, no Block state — but
   `POST /gif-cutout/apply` (a new history entry) is Block-owned, same division as
   every other tool's `'apply'` event.
2. **Read the preview** (`Output_Preview`, shown via `MpiVideoSurface`) to see which
   numbered index is which object.
3. **Chips** — 4 fixed checkboxes (`OBJECT_SLOTS`, matching `max_objects`), default
   all kept. Unchecking one re-dispatches `runGifCutoutTrack` with the SAME cached
   temp video (encoded once per frame-list signature) and the new `objectIndices`
   list — cheap, per the graph note above. Sending `''` when every chip is kept
   (rather than the literal list) matches the first Track call exactly. At least one
   chip must stay checked: `''` means "keep everything" server-side, the opposite of
   "keep nothing", so an all-unchecked state cannot be expressed and is refused
   client-side.
4. **Mask Adjust (Grow/Shrink) + Fill Holes + Invert**, set once for every frame.
   Grow/Shrink gets a LIVE preview on the current frame only, built with the exact
   same `managers/distanceField.js` functions (`signedSquaredDistanceField`,
   `rangeFor`, `writeRange`) `routes/gifCutout.js`'s `applyMaskAlpha()` runs
   server-side — decoded once per mask URL into a cached raw alpha + distance field,
   then every slider tick is a cheap range test over the cached field (the same
   "build once, range-test many" split `MpiToolOptionsMaskAdjust` uses, just re-keyed
   per mask URL instead of per tool-entry, because a GIF has many frames). Fill Holes
   has no live preview — it is cheap and deterministic at apply time, so a preview
   would not change the decision to turn it on.
5. **Cut out** — the panel validates the CURRENT `viewer.el.getFrames()` list still
   matches the frame signature the last Track ran against (a stale mismatch, e.g.
   after a strip reorder, is refused with a toast asking to Track again — masks are
   per frame POSITION, not per content hash, so a reorder invalidates them), then
   emits `{ frames, masks, adjust, invert }`. The Block posts `/gif-cutout/apply` and
   appends the result via `appendToHistory` + `_setCurrentIdx`
   (`MpiGroupHistoryBlock._handleGifCutoutApply`, same shape as the frame strip's own
   Apply, `_handleGifStripSave`'s `'new'` branch) — never through `/gif/entry`.

## Tint preview — not a mask/paint layer, no UndoStack entry

The panel emits two read-only previews so scrubbing reveals flicker before Cut-out
commits anything:

- `'mask-tint' { url }` — the CURRENT frame's ADJUSTED mask (grow/shrink + invert
  applied client-side, per above) → `MpiGifViewer.el.setMaskTint(url)`. A solid
  `--accent-heat` div clipped to the mask PNG via CSS `mask-image`, sitting inside a
  new `.mpi-gif-viewer__frame-wrap` sized to the frame `<img>`'s own letterboxed box
  (percentage-height-on-a-flex-item is what makes that sizing work; see the CSS
  comment).
- `'mask-overlay' { masks }` — every frame's RAW (unadjusted) tracked mask, index-aligned
  to the last `setFrames()` call → `MpiFrameStrip.el.setMaskOverlay(masks)`, one tint
  div per visible thumb. Index-keyed rather than hash-keyed (unlike every other
  frame-strip API) because a tracked mask belongs to a frame POSITION.

**This is deliberately NOT `docs/masking.md`'s layer model.** There is no
`manualCanvas`/`subtractCanvas`, no brush, nothing the user paints — the mask is
server-computed and the tint is a read-only preview of it, so the Critical Rules'
UndoStack requirement ("mutating a mask/paint layer needs an entry first") does not
apply: nothing here is mutated, only displayed. The mask itself "lives" only as the
panel's own `_masks` array, cleared on `el.destroy()` (leaving the tool, switching
history entries, or leaving the workspace all tear the Block down) — matching
`masking.md`'s "the mask lives until applied or the workspace is left" for the
canvas mask family, by the same instinct, through different means.

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
