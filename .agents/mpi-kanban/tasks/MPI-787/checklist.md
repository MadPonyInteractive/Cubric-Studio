# MPI-787 checklist

Reported on 1.6.1 by a tester: mask brush slow and jaggy on a 2960x2960 image, engine on
RunPod (so the canvas runs on that box's own, possibly weak, local GPU or CPU). Not
reproducible on the dev box, which draws canvases on a strong GPU.

## Root cause (measured, bench in real Electron 2D canvas, 2960x2960, brush 300)

Every `mousemove` runs the FULL `MpiCanvas.draw()`: the base canvas repaints the unchanged
image and the overlay repaints every layer edge to edge, both at image size (8.8 MP each).
MPI-214 capped the mask's working buffers at 1536 but left this display path full-frame.

First diagnostic run, one pass per row. `validation.md` holds the final 3x3-stroke means
(1.6.1: 23.5 fps / 11.9 ms, MPI-214 tree: 27.1 fps / 4.0 ms); the ordering is the same.

| variant (hardware acceleration OFF) | fps | median frame | JS / event |
|---|---|---|---|
| MPI-214 fix (efc2cc29) | 24.7 | 40 ms | 4.6 ms |
| 1.6.1 (current) | 21.0 | 44 ms | 13.5 ms |
| current, empty paint layer skipped | 24.1 | 40 ms | 5.1 ms |
| current, overlay not redrawn at all | 69.6 | 13 ms | 0.6 ms |
| current, overlay redrawn in a stroke-sized clip | 74.4 | 13 ms | 4.7 ms |

With hardware acceleration ON both trees run 75 fps. So: the full-frame overlay is the
floor, and MPI-375 (2026-08-03) made it worse by blending the image-sized paint layer on
every frame even when empty. Few frames = few mouse samples, and `strokeDabs` joins them
with straight segments: that is the "jaggy".

## Steps

- [ ] `brushDab.strokeBox()` — the image-px box a `strokeDabs(from, to)` call can touch
- [ ] Mask / Paint / Composite `paint()` return that box
- [ ] `InputController` mousemove: a stroke redraws only its box; a pure hover redraws only
      the screen UI; everything else keeps the full draw
- [ ] `MpiCanvas`: `_renderOverlay(clip)` + `_recolorMaskLayer(..., clip)`; stroke path skips
      the base (a stroke never changes it)
- [ ] Bench the patched tree: software + GPU
- [ ] Pixel check: a clipped stroke frame equals a full redraw
- [ ] `docs/masking.md` records the display-path rule
