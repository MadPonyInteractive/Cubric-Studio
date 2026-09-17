# Pending `js/components/types.js` hunk (MPI-771 Phase 3b)

`types.js` was under MPI-737's live claim (f5315739) on 2026-09-16, so these typedef edits were
not applied. Land them by hunk once the claim is released, then delete this file.

## `MpiToolOptionsGifCutoutProps` — replace the body after `@property {Object} viewer`

```
 * MPI-771 (plan Decision 14). SAM3 video tracking by name into a new alpha-cut
 * entry. Track All / Track Single Frame (the same graph on a one-frame video;
 * replaces only that frame's track) -> read SAM3_TrackPreview's numbered video ->
 * 4 object chips (max_objects; each name is stamped `name:4`, no count input),
 * each toggle re-dispatching the LAST scope -> Mask Adjust (Grow/Shrink live on
 * the current frame) + Fill Holes + Invert, once for every frame -> Cut out. The
 * masks live on the viewer (per frame position), shared with the Mask Brush.
 *
 * Requires viewer.el: getFrames(), getFrameIndex(), setTrackMasks(),
 *   setTrackMask(), hasFrameMasks(), getFrameMaskURL(), getCutMasks()
 * Block hooks on el: onFrameChange(), onMasksChange()
 *
 * Emits:
 *   'mask-tint' { url: string|null } — current-frame ADJUSTED preview;
 *               Block hands to viewer.el.setMaskTint(url)
 *   'apply' { frames, masks, adjust: {grow, fillHoles}, invert } — Cut out
```

## `MpiGifViewerProps` — add before `destroy()` and to Emits

```
 *   setTrackMasks(urls) / setTrackMask(idx, url) — MPI-771 engine masks per
 *                                       frame position; brush fixes survive
 *   hasFrameMasks() / getFrameMaskURL(idx) / getCutMasks()
 *   enterMode('mask'|'none') / exitMode() — Mask Brush: an MpiCanvas over the
 *                                       stage, the frame's track as BASE layer
 *   setMaskBrushMode / setMaskBrushPreset / setMaskInverted / isMaskInverted /
 *   setMaskBwView / isMaskBwView / setMaskPaintEnabled / setMaskOpacity /
 *   clearMask                         — the MpiMaskStrip surface
```

```
 *   'masks-change' { overlay, edited, cleared }
```

## `MpiFrameStrip` typedef (if it lists methods)

`setMaskOverlay(masks|null, edited = [])` — `edited` marks hand-fixed positions.

## Added 2026-09-16 (session d58ac006, Fabio's six findings)

- `MpiGifViewerProps`: `setFrames(frames, order?)` — `order[newPos]` = old position; the
  cut-out masks move with their frames, no `order` clears them. Play also works in the Mask
  Brush (plain frames under their mask tint).
- `MpiFrameStrip`: emits `'stage-change' { frames, order }`; a drag scrubs, a 300 ms hold then
  drag reorders; the pill has Discard.
- `MpiToolOptionsMaskBrushProps`: `@property {string} [mode]` — `gifMaskBrush` shows a note
  that the fixes are baked by the Cut-out tool.

## Added 2026-09-17 (session 93c7703f, Fabio's second check)

- `MpiGifViewerProps`: `isMaskEditing()`; emits `'edit-change' { editing }` when the Mask Brush opens or closes.
- `MpiFrameStrip`: gestures are pointer events owned by the strip (no native drag, no text selection).

## 2026-09-17 (Decision 15) — land with the rest

`MpiToolOptionsGifCutoutProps`: the panel now has a method switch (Remove background = op
`gifCutoutBirefnet` / By name = `gifCutoutSam3` / By colour = `js/utils/colourKeyMask.js`), and
`'apply'` carries `settings` ({ method, prompt?, objects?, colour?, tolerance?, edgesOnly? }).
Needs `viewer.el.setGenerating()` too.

New typedef after `MpiToolOptionsMaskTextProps` in `js/components/types.js`:

```
/**
 * @typedef {Object} MpiToolOptionsMaskColourProps (Organism — js/components/Organisms/MpiToolOptionsMaskColour)
 * @property {Object} viewer - MpiCanvasViewer instance
 *
 * The colour tool of the mask family (MPI-771): selects the pixels within Tolerance
 * of a key colour (default: the image's top-left pixel; Pick = native EyeDropper),
 * optionally only those connected to the border. No engine. Mounts MpiMaskDetectRow
 * and MpiMaskStrip WITHOUT the brush pair; Detect previews one pre-picked object,
 * Add/Subtract commit it. A control change after a run re-runs it (250 ms).
 * Requires viewer.el: enterMode('mask'), exitMode(), evaluateMask(),
 *   setMaskPointsMode(), setMaskTextMode(), setMaskColourMode(),
 *   setMaskColourParams({ colour, tolerance, edgesOnly }), runAutoMaskDetect(),
 *   getSourceElement()
 * No 'apply' emitted — mask is canvas-resident; PromptBox drives operations.
 */
```

`js/shell/preloadStyles.js`, after the `MpiToolOptionsMaskText.css` line:

```
  'js/components/Organisms/MpiToolOptionsMaskColour/MpiToolOptionsMaskColour.css',
```
