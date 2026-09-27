# MPI-957 - Canvas aliases large images when zoomed out

Observed 2026-09-27 during MPI-956. MpiCanvas draws the image at native px into
`canvas[data-role="base"]` and CSS-scales the stack (`ViewManager.getCSSTransform`).
An 8192x8192 image at fit sits at view.scale ~0.09, and fine detail aliases: a thin
circle renders dashed, 64 fine vertical lines collapse to 2-3 thick ones. Same on
`canvas[data-role="compare"]` (MPI-956) and on HEAD before MPI-956.

Suspected root: Chromium composites a CSS-downscaled canvas with bilinear filtering
and no mipmaps, so any reduction past ~2x skips source texels.

## Constraints

- Mask/paint/overlay coordinate spaces stay image-sized.
- Auto pixel mode (`styles/01_base.css` pixel-mode rules) keeps working.
- Compare slider / clip-path in `_drawComparisonLayer` keeps working.
- Base and compare canvases get the same treatment.
- Photographers load 16K images: memory matters.
