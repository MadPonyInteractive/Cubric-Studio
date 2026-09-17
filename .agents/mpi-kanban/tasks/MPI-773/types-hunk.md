# Pending `js/components/types.js` hunk (MPI-773 UI half)

`types.js` is under MPI-532's and MPI-774's live claims (2026-09-17). Land by hunk once released,
then delete this file. MPI-772's parked hunk: `tasks/MPI-772/types-hunk.md`.

## New typedef, after `MpiToolOptionsGifTimingProps`

```
/**
 * @typedef {Object} MpiToolOptionsGifTransformProps (Organism — js/components/Organisms/MpiToolOptionsGifTransform)
 * @property {Object} viewer - MpiGifViewer instance (reads getFrameSize())
 * @property {'gifResize'|'gifSaveFrame'|'gifToVideo'} mode - picks the tool
 *
 * MPI-773. Resize (every frame, Keep proportions), Save frame as image, GIF to Video
 * (background colour). The gif Crop is MpiToolOptionsCrop over the viewer's crop surface.
 * Settings persist to toolSettings.gifTransform (keepAspect, background).
 *
 * Emits:
 *   'apply' { tool: 'resize', width, height } | { tool: 'saveFrame' } | { tool: 'toVideo', background }
 */
```

## `MpiGifViewerProps` — add to the instance API

```
 *   enterMode('crop')                   — MpiCanvas in crop mode over the current frame;
 *                                         the box survives a frame step
 *   setCropRatio(r) / setCropSize(w, h) / getCropRect() — the MpiToolOptionsCrop surface
 *   getFrameSize()                      — Promise<{w, h}> of the current frame
```

`isMaskEditing()` now means any canvas tool (Mask Brush or Crop); `'edit-change'` fires for both.

## MpiCanvas (if its typedef lists methods)

`setCropRect({x, y, w, h})` — put the crop box back at an exact image-space rect.

## Also pending: `js/shell/preloadStyles.js` (MPI-774 owns it now)

`'js/components/Organisms/MpiToolOptionsGifTransform/MpiToolOptionsGifTransform.css',` right after
the MpiToolOptionsGifTiming line. Requested in reply a550e772. Check HEAD before adding.
