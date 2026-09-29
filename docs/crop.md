# Crop

The image crop tool: three resolution types, a rect that may leave the image, and the
server-side pad+extract that makes that possible. Video crop is a **different** code path
(see the last section).

Files: `managers/CropManager.js` (rect + snap + draw), `js/utils/cropSnap.js` (snap maths),
`MpiToolOptionsCrop` (panel), `MpiCanvasViewer._runCrop` (apply), `services/imageCrop.js` +
`POST /project/crop-media` (pixels).

## The three resolution types

| Type | Box behaviour | Output |
|---|---|---|
| `ratio` | locked to a `CROP_RATIOS` aspect (orientation-keyed table) | the selected pixels, rounded by **Divisible by** |
| `free` | each handle moves its own axis | the selected pixels, rounded by **Divisible by** |
| `resolution` | seeds at **exactly** the typed W×H image px, then stays locked to W/H | resampled to exactly W×H |

`resolution` is the ONLY type that resamples (MPI-383, user decision). Divisible-by is hidden
there — the typed size already IS the output. The other two never scale pixels: what the box
covers is what the file gets.

**Apply uses what the panel shows, carried on the event** (`apply { kind, settings }`, MPI-795).
Never re-read `project.toolSettings.crop` there, for two reasons. The saved copy lags the panel by
two debounces (200ms panel + 300ms queue). It is also PARTIAL: the entry starts as `{}` and only
keys the user touched get written. Before the fix, a W or H left at its displayed default
reached `_runCrop` as `undefined`, and the RESOLUTION crop silently skipped the resample.
`getToolSettings` now merges the saved keys over the defaults. That closes the `undefined`
hole for every tool, but it cannot fix the lag.

## The rect is not confined to the image

Any type may drag the box off any edge. Whatever it selects beyond the source is filled with
the panel's **Fill Outside** colour (`MpiColorPicker`, persisted per project as `fill_color`).

That flat colour is the point of the feature: it is the outpaint target. The user extends the
frame, then asks an edit model to fill the coloured area. **There is deliberately no auto-mask** —
prompting the model to fill "the black area" beats handing it a painted mask.

Consequences to keep in mind:

- `getCropRect()` can return **negative** `x`/`y`, and `x + w` can exceed the image width.
- Crop drawing lives on **`screenUICanvas`** (container space), not `overlayCanvas`. The overlay
  canvas is sized to image-native pixels, so anything outside the image is unpaintable there.
  Scrim, border, thirds, handles and the dashed source-bounds outline are all one screen pass
  (`CropManager.drawScreen`).
- The managed view frames **image ∪ crop** (`CropManager.getFitBox()` → `ViewManager.refit(..., fitBox)`),
  otherwise a 1920×1080 box on a 784px image hangs off the viewport.
- That refit is **suppressed while dragging** (`MpiCanvas._refitForCrop`). Scale is what maps the
  cursor into image space; changing it mid-gesture makes the rect chase the pointer. It settles
  on mouse-up, which is why `InputController`'s mouseup calls `onDraw()`.

## Snapping (`js/utils/cropSnap.js`)

An edge within **8 screen px** (converted to image px with `view.scale`) of an image bound lands
exactly on it, so a 1–2px accidental border is impossible. There is no bypass modifier — a
sub-8px border is the thing the feature exists to prevent.

- **Free**: only the edges the active handle owns snap, each to `0` or `imgW`/`imgH`. The anchored
  edge must not drift. Skipped while shift (scale-from-centre) is held — snapping one edge of a
  mirrored gesture silently breaks the mirror.
- **Body**: the whole box snaps flush-left/top, flush-right/bottom, or centred on the image.
- **Ratio-locked**: the ratio is the invariant, so snapping adjusts the **scale**
  (`snapRatioWidth`), never one edge. Every moving edge proposes the width that would land it on
  a bound; the smallest correction inside the radius wins. Sign 0 (edge handles,
  shift-from-centre) means both edges move, and it snaps symmetrically.

## Server: extract the part on the image, then extend

`services/imageCrop.js`. Sharp's `.extract` **throws** on an out-of-bounds rect, so the crop is
split into the part ON the image and the fill around it — ONE pipeline (MPI-990):

1. `planExtendedCrop()` — pure maths: `extract` = rect ∩ image in source pixels (`null` when they
   miss: the output is a solid fill, `sharp({ create })`), `extend` = the overhang per side,
   `resize` for the `resolution` family, `width`/`height` = the output size.
2. `cropPipeline()` — `.extract(intersection)` → optional `.resize(..., { fit: 'fill' })` →
   `.extend({...overhang, background: fill})`. Shared with `POST /gif/crop`
   (`routes/gifTransform.js`).

**Sharp applies `extend` after extract and resize, whatever the call order** — which is exactly
this order, so there is no intermediate image. It used to be the other way round: pad the WHOLE
image to a `.toBuffer()` (in the INPUT's format, so a JPEG took an extra q80 encode, up to 96 per
channel off), then extract. On a 16K photo that pass took 3 s and ~2 GB peak for a 4000x3000
crop; the one pipeline takes 0.35 s and 250 MB.

**A resample pads in OUTPUT pixels.** Resize runs before extend, so `planExtendedCrop` scales the
overhang (`scaleSpan`: rounded, never shrinking the image below 1px) and resizes only the
in-bounds part. The image/fill edge is crisp (the old pass blended fill into the photo's edge) and
can sit up to half an output pixel from where exact scaling would put it.

**The rect is in UPRIGHT pixels (MPI-959).** Chromium shows an EXIF-rotated photo turned, so the
box is drawn on the turned picture; sharp reads the stored grid unless told. Every input passes
`autoOrient: true` and the plan reads `metadata().autoOrient`, never `metadata().width`. Without
it a portrait phone photo (stored landscape, orientation 6) was cut in the wrong place and written
sideways. New imports are baked upright anyway (`docs/gallery.md` § Import); this covers files
already on disk. Test: `tests/image-orientation.test.cjs` (every case on a JPEG, compared exactly),
desktop `crop-resize-output.spec.js`. `autoOrient` turns the image BEFORE the extract, so the
intersection is in upright pixels too.

`roundToDivisible()` still floors when rounding up overshoots its `max` — the crop viewer now
passes `Infinity` because an overshoot is filled rather than clipped, but the bound stays in the
helper for the callers that cannot pad.

## GIF uses the image cropper (MPI-773)

The gif rail mounts this same panel with `kind: 'image'`. `MpiGifViewer` puts an
`MpiCanvas` in crop mode over the current frame and answers `setCropRatio` /
`setCropSize` / `getCropRect`, so unclamp, snap, fill and RESOLUTION all work. Apply goes
to `POST /gif/crop` (every frame, same rect; `outW`/`outH` for RESOLUTION), not
`crop-media`. A frame step reloads the canvas image and puts the box back with
`MpiCanvas.setCropRect`. Details: [gif.md](gif.md).

## Video uses a different cropper — Flows do not

`js/utils/cropTool.js` (normalized 0–1, used by `MpiVideoViewer` and `MpiStepBox`) is
**unchanged**: still clamped to the content, no fill, no exact-size family. The video crop route
crops with ffmpeg and cannot pad, so the panel hides the fill colour and the `resolution` type
for `kind: 'video'`.

**Flows do NOT port any of this** (MPI-594). The Outpaint flow's `crop` step mounts
`CropManager` itself — the class needs only a 2D context, an `{offsetX, offsetY, scale}` view
and the image size — so unclamp, snap and fill are the ONE implementation on both surfaces.
A change to how a crop rect behaves goes here, in `CropManager`, and both get it. The step's
two deliberate divergences (a ratio CONTAINS the image instead of inscribing it; the fill is
hardcoded black) are documented in
`docs/playbooks/add-flow/ui/crop-gizmo.md`.
