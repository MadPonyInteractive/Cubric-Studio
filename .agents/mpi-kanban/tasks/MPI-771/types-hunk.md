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
