# MPI-957 validation

## Root cause (measured 2026-09-27, before any code change)

Probe: 8192x8192 1px vertical black/white grating, opened at fit (view.scale 0.083, DPR 1).
Grey-level std of a screenshot over the grating (a correct downscale is flat grey, std 0):

| surface | std |
|---|---|
| sharp lanczos3 of the source, same displayed size | 0 |
| History PROMPT preview (`<img>` in the same CSS-transform stack) | 0 |
| MpiCanvas base canvas, HEAD | **74** |
| + `image-rendering: smooth` / `high-quality` / `-webkit-optimize-contrast` | 74 |
| `<img>` of the same source inside the MpiCanvas stack | 0 |
| reduced copy via 2D `drawImage` (low/medium/high), `createImageBitmap` high, halving | 0 |

So: Chromium composites a CSS-downscaled canvas with bilinear and no mipmaps. `<img>`
and 2D `drawImage` mipmap; no CSS value changes the compositor path. Flow steps
(Paint/Cutout/Crop/Place) draw through 2D `drawImage` and are not affected.

Cost: first mipmapped draw of an 8K source ~300ms (once per image), then ~0.2ms;
the native 8K base redraw that already runs on every pan/zoom tick is ~28ms.

## Fix

`_DisplayMip` in `MpiCanvas.js`: below half size (device px) the base and compare
canvases each hide behind a sibling drawn one power-of-two level down with
`imageSmoothingQuality: 'high'`, copying the native's CSS box (and clip-path). The
native canvases keep their pixels; overlay/mask/paint coordinate spaces untouched.

## Evidence

- `tests/desktop/canvas-downscale-quality.spec.js` green: base grating std < 10 at fit,
  squares land in place, native back at 2x (std > 40), compare side std < 10, compare
  mip carries the same clip-path.
- Same spec against HEAD's `MpiCanvas.js`: FAILS, `Received: 73.96` on the base std.
- Desktop: compare-native-resolution, crop-resize-output (2), history-modes, mask-colour,
  mask-persist-roundtrip (3), gif-cutout (5), gif-maker, gif-timing, gif-transform,
  gif-workspace (10) - all green.
- Unit: the 6 `.cjs` suites importing MpiCanvas.js, 103/103.
- ESLint clean on MpiCanvas.js.

## Remaining

Human eyes: a real 8K/16K photo in History (a tool mode) and in Compare, zoomed out.
