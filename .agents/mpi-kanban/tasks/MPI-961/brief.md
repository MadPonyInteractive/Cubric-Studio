# MPI-961 - Big photos (16K) make History unusable

Fabio, 2026-09-28. Part of umbrella MPI-962 (Big photos).

## The problem

The photographer tester (RTX 3060 12 GB VRAM, **16 GB system RAM**) works on 16K images in Adobe apps
without trouble. In Cubric Studio a 16K image makes the whole UI lag: mask strokes are nearly
impossible to draw, the UI freezes, the app becomes unusable. Photographers are a core audience
(memory `project_users_load_16k_images`).

## What is already known (do not redo)

- Decode past sharp's 268 MP limit: MPI-925 (done). 16K gallery thumbnails: MPI-926 (done). Offer to
  shrink on import: MPI-943 (done) - the user can decline, so full 16K must still work.
- Working buffers are ALREADY capped: mask `MASK_MAX_EDGE = 1536` (`MaskManager.js:44`), paint
  `PAINT_MAX_EDGE = 4096` (`PaintManager.js:39`), place `PLACE_MAX_EDGE = 8192`, composite 1536. So the
  mask buffer itself is small - the lag is probably elsewhere. Unmeasured.
- MPI-957 (doing, validating) changes how a large image is drawn zoomed out (moire at fit) - the same
  draw path. Read what it landed before touching it.
- A 16K RGBA decode is ~1 GiB. Each extra full-size copy (the `<img>`, a canvas backing store, the
  preview surface, a `getImageData` readback, a compare canvas) is another GiB on a 16 GB machine.

## Research, before any plan

Measure on a REAL 16K photo (not a 1 MP stand-in), in `npm run app:isolated`, with the DevTools
Performance + Memory panels:

1. Where the frame time goes during a mask stroke: `draw()` per pointermove? a full-res `drawImage`
   each redraw? a `getImageData` on the base (`MaskManager.js:494`)? GC pauses?
2. How many full-size copies of the image are alive (renderer heap, GPU memory) after opening one
   16K card, after entering Mask, after switching entries.
3. What the main thread does on entry load (decode on the main thread? `img.decode()`?).

## Candidate techniques (to test against the measurements, not to adopt blindly)

- **Display proxy / mip levels:** draw from a screen-sized (e.g. <= 4K) bitmap at fit, and a
  full-res TILE only when zoomed in past 1:1 (the Photoshop / Lightroom model). `createImageBitmap`
  with `resizeWidth` / `resizeQuality` makes the levels off the main thread.
- **Tiled rendering:** draw only the tiles in view at the current zoom.
- **Pixel work off the main thread:** `OffscreenCanvas` in a worker for flood fill / mask readbacks.
- **Full resolution only at Apply, on the server:** the canvas edits a proxy and sends coordinates +
  a proxy-resolution mask; sharp applies them to the original (crop already works this way).
- **Free the big copies** the moment they are not on screen (`canvas.width = 0`, `bitmap.close()`).

## Verify (when it becomes a plan)

- The same measurements before and after, on the same 16K file, recorded in `validation.md`.
- Fabio (or the tester) draws a mask on a 16K photo and it keeps up with the pen.
