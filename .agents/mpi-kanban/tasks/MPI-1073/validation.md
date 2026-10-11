# MPI-1073 validation

## Automated (2026-10-11)
- `node --test tests/video-extract.test.cjs` - 5/5: tracker source keeps one frame per frame of
  the trim and caps the long edge; masks pair by INDEX (alternating masks per frame); real VP9
  alpha + hidden RGB zeroed; Colour fill; a transparent WebM source keeps its first cut; the
  route lands a `.webm` entry + sidecar and removes its temp masks.
- `npm test` - 3107 pass, 0 fail. ESLint `--max-warnings=0` clean on every touched file.

## Live, own `app:isolated` instance (scratch profile + APP_DOCUMENTS, port 49302)
Synthetic per-frame masks injected through `setVideoMasks` (no engine run):
- Mask group + Text panel mount in the video rail; panel matches the image Text tool.
- Tint lands on the letterboxed frame; follows frame steps (frame 30) and playback
  (23 distinct masks in 1.2 s of play); B/W view correct.
- Extract Transparent -> `videoExtract_001.webm` entry; the player shows real transparency
  paused AND playing. Extract Colour -> `videoExtract_002.mp4`, colour fill correct.
- Colour -> Transparent -> Colour on the strip: no console error (the MPI-1072 crash fix).

## Not yet seen
- A REAL SAM3 track on a real clip (needs the engine) - Fabio's eye-test.

## Follow-ups (2026-10-11, session "Mask extraction 3")
- `node --test tests/video-extract.test.cjs` 6/6 (new: ProRes keeps alpha + audio).
- `npm test` 3119 pass / 0 fail.
- Desktop: `video-mask-stash.spec.js` 1/1, `colour-pick-eyedropper.spec.js` 1/1 (with the Extract
  swatch), `gif-maker.spec.js` 1/1. eslint --max-warnings=0 clean on every touched file.
- Fabio eye-test 2026-10-11: mask carried across Extracts on a real track, Pick shown, videoExtract_004_prores4444.mov composited with alpha in DaVinci Resolve 20.
