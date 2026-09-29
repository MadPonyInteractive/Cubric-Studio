# MPI-959 validation

Code: `28547517d` (fix), board `3c14e7481`. Session 1afba052, 2026-09-29.

## Root cause

Chromium (the canvas) and the engine's loader (`MpiLoadImage` in ComfyUi-MpiNodes `img.py`,
`ImageOps.exif_transpose`) both show an EXIF-rotated photo upright, so every rect, mask, paint
layer and box the app sends is in upright pixels. Every server `sharp(...)` reader used the stored
grid (`metadata().width`, no `autoOrient`). Fabio's decision (2026-09-28): both fixes.

## What changed

- Import: `bakeOrientation` (`routes/imageImport.js`) runs after `/project-media/:id/upload`
  writes a file and inside `placeContentAsset` (staged agent / Flow assets). Same format, EXIF and
  ICC kept, orientation 1. Nothing to turn = not rewritten (byte-for-byte test). The sidecar's
  `pixelDimensions` come from the baked file.
- Readers now use `autoOrient`: `cropExtended`, `compositeThroughMask`, `compositeOverlay`,
  `/connector/describe` (crop, box, imageSize), `/llm/describe`, `viewFile` size (view_card), Make
  GIF from stills, the save-generation size probe, the agent's `_imageSize` (it also picks a
  source-matching ratio, so a portrait photo got a landscape ratio before).
- Not touched: `upload-raw` (no caller anywhere in the repo), GIF frame routes (frames carry no
  EXIF), `resolveDisplayImage` / `extractImageThumb` / `deepinfraCollage` (already `.rotate()`),
  `routes/deepinfra.js` `_readReference` sends a small reference untouched (old files only; new
  imports are baked).

## Evidence

- `tests/image-orientation.test.cjs`: 14 tests, red before the fix (10 of 11 then), green after.
  Every consumer is run on a rotated file and on its upright twin; ramp fixture; orientations
  5, 6, 8; import via disk path and base64, JPEG, PNG and WebP.
- Full unit suite: 2290 pass, 0 fail.
- Desktop, own Electron instance: `crop-resize-output.spec.js` (new orientation-6 crop, box low in
  the portrait frame so it is out of the stored grid) + `stack-crop.spec.js`: 4 passed.
- Real file, read-only: Big Photos Test `Media/imported_001.jpg` (4096x3072, orientation 6).
  Bottom-left quarter crop 1536x2048 in 76 ms, mean diff 0.70 vs the upright reference, label text
  reads upright. A COPY baked in 159 ms to 3072x4096, orientation 1, EXIF kept (18405 bytes).
- CI: run 36574135426 on `28547517d` green (unit + desktop shards 1-4).

## The brief's four "why it fails" cases

1. **Tag 1 on sideways pixels** (sensor off, scanner, screenshot): undetectable; the file is left
   byte for byte. The answer is the Resize tool's `rotation`.
2. **Stale tag** (pixels already turned, tag kept): Chromium, the engine and sharp all honour it,
   so the app is consistent and the bake turns it the way the user saw it. Resize `rotation` fixes.
3. **Orientation outside JPEG EXIF** - measured in the app's own Electron (Chromium 146):
   PNG `eXIf` honoured by Chromium and sharp (baked, lossless). AVIF/HEIF come out of libheif
   already upright for both. XMP-only `tiff:Orientation`: neither reads it (consistent). HEIC:
   the bundled sharp cannot decode it and Chromium cannot display it, so it never works as a
   still, bake or not. **WebP EXIF: Chromium IGNORES it, sharp honours it.** New imports are
   baked (the probe and reduce already treated the tag as real), and the sidecar takes the baked
   size because the renderer measured the stored one. Ceiling: a tagged WebP imported before this
   change shows sideways in the canvas while the readers read it upright. None known.
4. **Something reads a copy made before the turn:** the bake runs before `writeImageRenditions`
   and before the sidecar is written, so thumbs and `pixelDimensions` come from the upright file.

## Left

- Fabio crops a real portrait phone photo (Big Photos Test `imported_001.jpg`), single card and a
  stack. That file is still stored sideways on disk (imported before this fix), so it exercises
  the reader half; a fresh import of any portrait phone photo exercises the bake.
