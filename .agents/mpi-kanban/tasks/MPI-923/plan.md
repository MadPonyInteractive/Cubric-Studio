# MPI-923 Plan - Wan 3.0 reference-to-video + first/last frame

Umbrella: MPI-985. Card description holds the why.

## Current State

- 2026-09-30 (Agent 77): built and unit-verified (validation.md). ref2v live PASSED ($0.595,
  reference video bills its seconds: quote now a ceiling). Next: the i2v end-frame live run
  ($0.25) on Fabio's fresh yes, then close. Uncommitted.

## Facts (DeepInfra keyless schema, 2026-09-30)

- `media: [{ type, url }]`, `url` = URL or base64. Types `first_frame`, `last_frame`,
  `reference_image`, `reference_video`, `reference_audio` (plus `file`, `link`, unused).
  References are mutually exclusive with first/last frame.
- Prompt names refs `Image n` / `Video n`, declaration order, images and videos counted apart.
  No audio identifier is published.
- $0.05/s at 480p. A reference video + output must total <= 30 s. **A reference video's seconds
  are billed too** (live 2026-09-30: 6.9 s ref + 5 s clip billed $0.595); image and audio refs are
  free. The quote is therefore a ceiling ("up to") whenever a reference video is staged.
- Limits: images 240-8000 px, 20 MB; video MP4/MOV 1-15 s, 100 MB; audio WAV/MP3 1-15 s, 15 MB.
  No published count cap.

## Work

1. `commandRegistry.js`: new single-stage `ref2v` op ("Reference to Video"), 9 image / 3 video /
   3 audio ordinal slots, image/video chips tagged `Image n` / `Video n` (Wan's own names).
   `i2v` gains an optional `endFrame` slot behind `requiresCapability: 'endFrame'` (Wan 2.2 5B
   local has no end-frame node, so it must not see it).
2. `operationRegistry.js` + `operation_registry.json`: register `ref2v`.
3. `models.js` `wan3-cloud`: `supportedOps` + `ref2v`, `capabilities.endFrame`, `audio` (so the
   audio slots survive `filterMediaInputsForModel`).
4. `cloudExecutor.js`: send each staged item with its slot (role-first, then media type in slot
   order, as `commandExecutor` maps them) so video, audio and the end frame reach the route.
5. `routes/deepinfra.js`: Wan typed media list from those slots; refuse (unbilled) a reference
   video whose length + the clip's exceeds 30 s only if cheaply knowable, else leave it to the 422.
6. Tests: `tests/deepinfra-wan-media.test.cjs`. Docs: `docs/cloud-generation.md`.

## Verification

**Verify mode:** auto for shapes; then 2 paid live runs (ref2v, i2v with end frame), 480p 5 s,
$0.25 each, Fabio's yes 2026-09-30 covers exactly those two.
