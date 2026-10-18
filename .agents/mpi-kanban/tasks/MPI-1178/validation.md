# MPI-1178 validation

## Problem

Fabio attached his 1024x1024 drawing card to Cosmo and asked for Nano Banana 2. The edit came back
1408x768 (1.85:1). Sidecar: no ratio in `generationSettings`, so `buildSizeFields` 'aspect' sent no
`aspect_ratio`, on the old belief (research 01d) that Nano Banana follows the reference then.

## Shipped (commit a0db26aa5)

- `js/data/modelConstants/deepinfraSizing.js` 'aspect': no picked ratio/size -> the source's
  nearest allowed label (the route already passes image 1's upright size, as for 'wh'/'size').
- `tests/cloud-edit-follows-source.test.cjs`: square -> 1:1, 1365x1024 -> 4:3, 1080x1920 -> 9:16 on
  nano-banana-2 and -lite; a picked 16:9 still wins; t2i with nothing sends nothing. The old test
  asserted `{}` for a source, so it fails on the old code.
- Cloud sizing tests (follows-source, deepinfra-catalogue, cloud-price-tag, cloud-duration-bounds):
  49/49. eslint clean.
- `docs/cloud-generation.md`, research 01d corrected; `UNRELEASED.md` Fixes line.

Not re-run as a paid edit: the request body is the unit under test, and the body is asserted.
