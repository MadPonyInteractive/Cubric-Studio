# MPI-964 validation

2026-09-28 — new Compound `MpiColorField` (picker + EyeDropper Pick); all five hand-rolled
copies replaced: Remove Background, Paint, Paint Adjust, GIF cut-out By colour, image Colour mask.
CSS registered in `js/shell/preloadStyles.js`, props in `js/components/types.js`.

- `tests/desktop/colour-pick-eyedropper.spec.js` (extended to all five): 1 passed. Stubbed
  EyeDropper; each panel has exactly one `.mpi-color-field`, Pick lands the hex in the swatch,
  Paint + Adjust hand it to `setPaintColor`, the Colour mask to `setMaskColourParams`. No page errors.
- `tests/desktop/gif-cutout.spec.js` (Pick selector moved to `.mpi-color-field__pick`): 5 passed.
- `tests/desktop/mask-colour.spec.js`: 1 passed.
- `node --test` flow-frame, flow-result-dock, mask-tool-registry, paint-adjust: 83 passed.
- eslint on every touched file: clean.
- Screenshot reviewed: one identical swatch + Pick row in all five panels. Visible change:
  the GIF cut-out and Colour mask swatches now span the row like the Paint ones.

Remaining: Fabio's look in the real app.

CI run 36406914127 on fbb1888a0: success.
Claim audit: 17 proven, 0 false. Correction to the commit message: the image Colour mask's old Pick had no icon, so MpiButton drew it as an empty box; MpiColorField gives it the eyedropper icon and label, a fix rather than a like-for-like swap.
Fabio, 2026-09-28: "It's looking good." No gallery demo wanted. Rule update approved and landed in d7a0293c8.
