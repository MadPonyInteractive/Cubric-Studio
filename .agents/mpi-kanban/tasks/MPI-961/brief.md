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

## Design (brainstorm with Fabio, APPROVED 2026-09-28)

Goal in Fabio's words: no lag, and the UI never breaks or stops moving on a big image.

**Prime suspect (code read, NOT yet measured):** `MpiCanvas` sizes the base AND overlay canvases to
the image, clamped only to the GPU's `MAX_TEXTURE_SIZE` (`MpiCanvas.js:109`) - 32768 on NVIDIA, so a
16K photo is not clamped at all. Each is ~1 GiB; the mask tint scratch (`_recolorMaskLayer` ~:1170,
built at overlay size in invert / auto / adjust view) is a third, the decoded `<img>` a fourth.
`draw()` repaints base + overlay edge to edge on every pan / zoom tick (MPI-957 measured ~28 ms per
base redraw at 8K). Only brush moves are clipped (`drawStroke`, MPI-787). The image-sized overlay
buys nothing: mask is capped at 1536, paint at 4096. Also: Chromium's max canvas AREA is 16384^2,
so a 32K image likely renders blank today rather than lagging.

**Chosen: B - display copy + detail layer (the Lightroom / Photoshop model, two levels):**

1. **Display copy.** On load, make a copy capped at ~2x the screen's long edge (e.g. ~4K), off the
   main thread (`createImageBitmap` with `resizeWidth` / `resizeQuality: 'high'`). Base + overlay
   canvases are sized to it, not to the photo. Overlay coordinate code already copes with a clamped
   overlay (the `k = W / img.width` scale in `drawStroke`).
2. **Detail layer.** Zoomed in past the display copy's 1:1, a SCREEN-sized canvas draws only the
   visible region from the full-res source, on pan / zoom SETTLE (debounced), never per tick. Soft
   while moving, sharp when stopped - what Lightroom does.
3. **Full resolution stays on the server.** Crop / composite already cut the original with sharp in
   image coordinates. Plan must confirm EVERY export path reads the original or sends coordinates,
   never the canvas's own pixels.
4. **Video:** same sizing path (`MpiCanvas.js` ~:600 is a TWIN of `_sizeImageCanvases` - fix both).
   Display cap only, no detail layer. The cap (screen x2) leaves 4K video native; 6K-8K is capped.

**Rejected:** C (screen-space tile renderer for everything) - rewrites MpiCanvas's coordinate model
(CSS transform stack, pixel mode, compare clip-path, crop, place, stroke clip, MPI-957's mip) for
little over B. Raising `MASK_MAX_EDGE` (1536): kept for now (Fabio) - models see ~1-2 MP anyway;
blocky mask edges when zoomed on 16K are a separate card if the tester complains.

**Open for the plan:** is the full-res `<img>` kept alive for the detail layer (1 GiB) acceptable on a
16 GB machine, or does the detail layer read server-side regions (sharp `extract`) instead? Let the
memory measurement decide.

## Test fixtures

Project **Big Photos Test** (`C:/Users/Fabio/Documents/Cubric Vision/Projects/Big Photos Test`):
ILL Anime 1024 -> `imageUpscale` x4 -> 4096 -> x4 -> 16384 (one card, history entries). 32K made
with sharp lanczos3 from the 16K (the History upscaler always runs its 4x model before scaling down:
16K -> 32K would build a 65536^2 float tensor, ~51 GB). Note DPI / "Resolution 300" is a print tag
only - pixel count is the whole cost. Fabio's box (4060 Ti 16 GB, 64 GB RAM) may not FEEL the 16 GB
tester's lag at 16K: record numbers, not feel.

## Verify

- The same measurements before and after, on the same 16K file (+ the 32K as stress), recorded in
  `validation.md`: frame time during pan and a mask stroke, renderer + GPU memory after open and
  after entering Mask.
- Fabio baselines 16K + 32K by hand now, re-tests after the fix; his OK closes it. The tester's
  OK on a real 16K photo is the bonus.
