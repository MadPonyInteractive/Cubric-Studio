# MPI-925 Validation

## Reproduction (2026-09-25)

A real 16384x16384 JPEG (`sharp({create}, limitInputPixels:false).jpeg().toFile()`, 1.5 MB)
on sharp 0.34.5:

- `sharp(file).metadata()` → throws `Input image exceeds pixel limit` (the limit fires on the header read too)
- `sharp(file).resize(64).toBuffer()` → throws the same
- `sharp(rawBuffer, { raw: 16384x16384 })` → throws the same (raw, `joinChannel` and `composite` inputs carry the limit too)
- `sharp(file, { limitInputPixels: false }).metadata()` → 16384

## Tests

`node --test tests/sharp-16k-inputs.test.cjs`, 11 tests, ~12 s:

| | before (HEAD `5e607ad2`, scratch worktree) | after |
|---|---|---|
| fixture is past the limit | pass | pass |
| cropExtended inside / extending | FAIL x2 | pass |
| compositeThroughMask, compositeOverlay | FAIL x2 | pass |
| /llm/describe full, cropped | FAIL x2 | pass |
| /connector/describe crop, box | FAIL x2 | pass |
| save-generation size probe | FAIL | pass |
| Make GIF (16K stills → 4096 frames) | FAIL | pass |

Neighbouring suites (mask-composite, crop-*, gif-make, llm-*, connector-*, splat-companion,
image-thumb-alpha, audio-media-type): 138/138 pass.
Full `npm test`: 1926 pass, 1 fail. The failure was `mask-tool-registry.test.cjs`'s source regex
pinning `sharp(overlayPath)`. After loosening it: 44/44.

## Not changed, and why

- **GIF frame-store readers** (`gifCutout`, `gifToVideo`, `gifTransform`, `gifFrames.buildGif` /
  `blendEdgeColour` / `builtGifDimensions`): the frames they read come from Make GIF, which now caps them at 4096,
  or from ffmpeg (next line). A 16K frame would fail in their own ffmpeg pass anyway.
- **ffmpeg-sourced reads** (`gifMaker.js:165`, `gifFrames.extractFramesFromGif`): ffmpeg refuses
  a 16K picture before sharp ever sees it (`Picture size 16384x16384 is invalid`, measured).

## Found, out of scope

The gallery thumbnail for an image is **ffmpeg**, not sharp (`services/ffmpegThumb.js`
`extractImageThumb`). A 16K import gets NO thumbnail: ffmpeg's size check is compiled in,
so no flag lifts it. Measured on the same fixture: `Picture size 16384x16384 is invalid`, thumb `null`. Filed as a follow-up card.
