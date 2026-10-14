# MPI-1141 validation

Shipped in `8ef55aa7a` (master).

## Root causes
1. `CropManager.setRatio` always called `_applyRatioToRect()` = `largestCentredRect`, discarding the user's box.
2. Any wheel zoom / pan sets `view.isManagedView = false` permanently; `_refitForCrop` bails on an unmanaged view, so nothing re-framed image ∪ box after a ratio change until `loadImage` reset it (gallery round-trip).

## Evidence
- `tests/desktop/crop-ratio-keeps-box.spec.js` (1024² image, like Fabio's screenshot): FAILED on the old code at both halves (centre moved 112 px on 2:1 → 4:3; after a wheel zoom the 16:9 box stayed off-stage), PASSES now, incl. a Mask → Crop round-trip after zooming off the box.
- `stack-crop.spec.js`, `crop-resize-output.spec.js` (6), `flow-big-photo.spec.js` (2): green.
- Unit: 67/67 across crop/box/outpaint/shape tests incl. new `tests/crop-reshape-rect.test.cjs`. ESLint clean on all touched files.

## Not verified live
- Video crop (`cropTool.setRatio(r, { keep: true })`): no spec covers it; same helper, unit-tested maths only.
- Fabio's own feel check in his app (needs a renderer reload, Ctrl+R).
