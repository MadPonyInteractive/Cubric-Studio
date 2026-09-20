# MPI-844 — checklist

- [x] `builtGifDimensions(absPath)` in `services/gifFrames.js`, exported.
- [x] `routes/gif.js` ×2 (update + new) measure the built file.
- [x] `routes/gifCutout.js` measures the built file.
- [x] `routes/gifMake.js` measures the built file.
- [x] `routes/gifTransform.js` — `_writeNewGifCard` drops its `pixelDimensions` param and
      measures; both callers (crop, resize) fixed by that.
- [x] `routes/gifMaker.js` uses the helper instead of its own inline `sharp().metadata()`.
- [x] New test: frames larger than `maxEdge` land the BUILT size on the card.
- [x] `gif-transform.test.cjs` 405×723 → 406×723, with the reason in the assertion message.
- [x] `docs/gif.md`: what `pixelDimensions` means on a GIF card.
- [x] GIF node tests green, lint clean.
