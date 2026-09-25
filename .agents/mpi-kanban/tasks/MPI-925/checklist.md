# MPI-925 Checklist

- [x] Reproduce: a real 16384x16384 JPEG throws "Input image exceeds pixel limit" on `sharp(file).metadata()`, on a decode, and on a raw input.
- [x] `routes/connector.js` describe: crop measure + extract, box measure, size report pass `limitInputPixels: false`.
- [x] `routes/llm.js` describe: size from `metadata()` (no full raw decode), one pipeline, still bounded to 1 MP.
- [x] `routes/projects.js` save-generation size probe.
- [x] `services/imageCrop.js` `cropExtended`, both passes.
- [x] `services/imageComposite.js` `compositeThroughMask` + `compositeOverlay`, including raw, joinChannel and composite inputs.
- [x] `routes/gifMake.js`: reads a 16K still and caps the frame canvas at 4096 (the builder's `MAX_EDGE`).
- [x] GIF frame-store readers left alone: a 16K frame can no longer reach them (see validation.md).
- [x] `tests/sharp-16k-inputs.test.cjs`: one test per fixed path, fed the real 16K JPEG. Red before, green after.
- [x] `tests/mask-tool-registry.test.cjs` source regex allows input options on `sharp(overlayPath, ...)`.
- [x] `docs/gif.md` names the Make GIF bound.
