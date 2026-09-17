# MPI-796 validation

## What shipped

Two new Resolution Types in `MpiToolOptionsResize`:

- **MP**: a Megapixels number input (ComfyUI's megapixel, 1024 x 1024 = 1 MP).
- **SCALE**: a radio of 1.5 / 2 / 3 / 4, dividing the source width and height.

Both derive width/height from the source size (`deriveResizeDims` in `js/utils/ratios.js`), keep the aspect, show the result in a read-only Width/Height pair, and recompute when the history item changes. Apply still sends plain `width`/`height`, the same keys FREE sends, so the workflow path is unchanged. `megapixels`/`scale` also ride along, but inertly: `resize.json` and `resize_video.json` have no `Input_` title that matches either.

Also fixed on the way: switching back to FREE now shows the size Apply will send. Before this change the free inputs kept a stale value after SDXL/FLUX had moved width/height.

## Evidence

- `tests/resize-derived-dims.test.cjs`: 3/3 pass (SCALE maths, MP pixel count and aspect, null for other types, unknown source or bad value).
- `tests/desktop/crop-resize-output.spec.js` resize test, real Electron, 400x300 source: SCALE /2 -> 200x150, /4 -> 100x75. MP 0.25 -> 591x443. Both the read-only pair and `getParams()` (what Apply sends) are checked, and FREE shows 591x443 afterwards. The same spec fails on pre-fix code (no SCALE option).
- Screenshots of the SCALE and MP states looked right: new rows sit in the Resolution Type section, and the read-only pair uses the darker read-only input style.
- `npm test` green, eslint 0 errors.

## Not verified

- A real Apply through the engine. The E2E profile has no engine, and the user's engine must not be used. The Apply payload is the same width/height FREE already sends, so ImageResizeKJv2 is not exercised by anything new.
- The video Resize panel (same component, `kind: 'video'`). Source size there comes from `videoWidth`/`videoHeight` via `extractThumbnail`. The code path is shared, but no video run was made.
- The read-only pair shows the size before `Divisible by` rounding, which is what FREE shows too. The node rounds afterwards.
