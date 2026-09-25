# MPI-926 Validation

## Reproduction (2026-09-25)

`extractImageThumb` on a real 16384x16384 JPEG returned null: ffmpeg `Picture size 16384x16384 is invalid`.
The limit is compiled into ffmpeg, measured exactly: `(w+128)*(h+128) <= INT_MAX/8`, so 16255^2 thumbnails and 16256^2 fails.
ffmpeg honours EXIF orientation (an orientation-6 800x400 JPEG thumbs 400x800). sharp cannot read BMP.

## Fix

`services/ffmpegThumb.js`: an image past that limit thumbs through sharp (`limitInputPixels: false`, `rotate()`, same width, WebP q82). Everything ffmpeg can decode keeps the ffmpeg path byte for byte, BMP included.

## Tests

- `tests/sharp-16k-inputs.test.cjs`: `extractImageThumb` on a 280 MP EXIF-6 JPEG gives a 512x731 upright WebP; save-generation of a 16K result writes both renditions (512, 1280). Both red before the fix ("no thumbnail", "no thumbPath on a 16K result"), green after.
- Neighbours (image-thumb-alpha, gallery-renditions, audio-waveform-alpha, gif-make, gif-frames, splat-companion, mcp): 65/65.
- Full `npm test`: 1928 pass, 0 fail.
- Alpha on the sharp branch (probe, not a suite test): a fully transparent 16384^2 RGBA PNG thumbs to a 512x512 WebP with `hasAlpha: true`, max alpha 0.

## CI

Run 36160802400 on `3d0c5cf9`: success.
