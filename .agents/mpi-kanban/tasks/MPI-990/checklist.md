# MPI-990 checklist

- [x] `planExtendedCrop` returns the in-bounds intersection (extract, source coords) + the overhang (extend), and flags a rect with no intersection
- [x] `cropExtended` runs ONE pipeline: `extract(intersection)` then `extend(overhang)`; no-intersection rect = solid fill of w x h; `limitInputPixels: false` + `autoOrient: true` kept
- [x] RESOLUTION resample: overhang scaled to output pixels (sharp resizes before it extends)
- [x] `POST /gif/crop` (`routes/gifTransform.js`) on the same `cropPipeline`
- [x] `tests/crop-extend.test.cjs` updated with the plan
- [x] `tests/image-orientation.test.cjs` overhang case runs on the JPEG fixture, exact
- [x] `tests/sharp-16k-inputs.test.cjs` passes
- [x] desktop `crop-resize-output.spec.js` + `stack-crop.spec.js` pass
- [x] `docs/crop.md` § Server rewritten (no two-pass, no extra encode)
- [x] CI green on `7c65e9665` (run 36577491716: unit + desktop 1-4)
