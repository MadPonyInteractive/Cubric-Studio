# MPI-990 validation

Code: `7c65e9665` (services/imageCrop.js, routes/gifTransform.js, 3 tests, docs/crop.md).

## What changed

`planExtendedCrop` returns the rect's intersection with the image (source pixels, `null` when
they miss), the overhang per side (output pixels), an optional `resize` (RESOLUTION family) and the
output size. `cropPipeline` runs extract -> resize -> extend as ONE sharp pipeline (sharp applies
extend after extract and resize whatever the call order); a miss is `sharp({ create })` fill.
`cropExtended` and `POST /gif/crop` (`_cropFrameBuffer`) both use it. No intermediate image, so no
JPEG re-encode and no whole-image buffer.

## Evidence (2026-09-29)

- `tests/crop-extend.test.cjs` + `tests/image-orientation.test.cjs`: 28/28. The orientation
  overhang case now runs on the JPEG fixture, compared EXACTLY, plus `overhangResampled` and `miss`
  cases. Mutation check: the same test against HEAD's two-pass fails on all three orientations
  (`overhang: pixels differ by up to 79 / 150 / 144`).
- `tests/sharp-16k-inputs.test.cjs` + `tests/gif-transform.test.cjs`: 23/23 (16K overhang now
  also asserts the fill pixel). `connector-gif`, `connector-gif-jobs`, `gif-frames`: 66/66.
- Desktop, own port: `crop-resize-output.spec.js` (3) + `stack-crop.spec.js` (1): 4/4.
- CI on `7c65e9665`: run 36577491716 green (unit + desktop shards 1-4).
- GIF parity (scratch script): an RGBA frame overhang crop is byte-identical to the old lossless
  PNG pass; transparent pixels stay transparent, fill is opaque; a miss is 4-channel fill.
- 16K noise JPEG, peak RSS per process:
  - 4000x3000 crop overhanging top-left: old 3176 ms / 1951 MB -> new 354 ms / 249 MB
  - 3000x2000 crop past bottom-right, resampled to 1500x1000: 4146 ms / 2022 MB -> 1613 ms / 338 MB
  - whole image + 200px margin (output bound): 5.9 s -> 3.0 s, both ~1.98 GB
- Resampled overhang vs old, lossless source: integer-aligned scale is identical except within
  4px of the image/fill edge (old blended fill into the photo edge, worst 27); a non-integer
  scale can sit up to 0.5 output px off (mean 0.4 levels).

## Left

- `docs/README.md:89` map line still says "pad-then-extract" - held by the live MPI-989 claim.
