# MPI-956 validation

## Root cause

`MpiCanvas._drawComparisonLayer` drew the AFTER media into `overlayCanvas`, whose backing store is
sized to the BEFORE image. With a 1K before and an 8K after, the 8K was rasterized to 1K and the
compositor magnified that 1K when zooming. In the reverse order the base canvas was 8K, so the
8K kept its pixels, which is why the result depended on click order. All three compare surfaces
(Gallery Compare overlay, Flow result pane, History viewer compare) go through this one method.

## Fix

The after side gets its own `canvas[data-role="compare"]` in the stack, between base and overlay,
at its native size (clamped to `MAX_TEXTURE_SIZE` like the base). CSS cover-fits it over the base
frame and `clip-path` cuts it at the slider and to the frame. An image is drawn once, a video every
draw. Auto pixel mode is set per canvas (`styles/01_base.css`), because the two sides are magnified
by different amounts. The canvas is freed when compare ends.

## Evidence

- `tests/desktop/compare-native-resolution.spec.js` (512 vs 4096, the same 8x ratio as 1K vs 8K;
  a 1px checkerboard that averages to one grey if squashed):
  - against HEAD's `MpiCanvas.js`: FAILS (no native after layer; the after side is the overlay's 512).
  - with the fix: passes, 3 of 3 with `--repeat-each=3`. Both orders keep native px and the checker.
  - A first run failed on a TEST race (a fresh canvas is 300x150 before any draw, so `width > 0`
    matched too early). The spec now waits on the layer being shown.
- `history-modes.spec.js` 3 of 3, `tests/flow-result-compare.test.cjs` 8 of 8.
- Visual probe, real 1K + 8K of the same content, zoomed about the slider: old code shows the same
  grey 1K bars on both halves; the fix shows crisp 8K lines on the after half, meeting the before
  half exactly at the bar.
- Video after side (1280x720 over a 320x180 still): compare canvas at 1280x720, visible, frames
  change during play.

## Not in scope

Zoomed OUT, an 8K side shows moire on fine detail. It is the same when the 8K is the BASE (reverse
order, and on HEAD), so it is how MpiCanvas shows any large image below 1:1, not this bug.

## CI

Run 36320295259 on `d1482d666` (carries the fix `0c7bb02f9`): success, 2026-09-27.
