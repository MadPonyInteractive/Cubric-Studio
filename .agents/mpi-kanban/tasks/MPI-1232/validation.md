# MPI-1232 validation

Bench phase: Fabio eye-checks faces + overlaps at 1:1 in `research/`. Wiring validation is written after he picks what gets built.

## Phase 1 + 2 (2026-10-23, session "Tile upscaler improvements 5")

- Phase 2: `npm test` 3534 tests, 3532 pass, 0 fail, 2 skipped (DeepInfra key); `npm run lint` exit 0; desktop
  `tests/desktop/prompt-box-use-tiles.spec.js` 1 passed (isolated app). New `tests/tiles-denoise-default.test.cjs`.
- Phase 1 static: `validate-injection-rules.mjs` "All 7 file(s) conform"; scratch verify: all 14 runtime graphs carry the
  4 tile ints/floats + Tile_Prompts, 2 detectors, 3 DetailerForEachPipe (people at 0.25), filter_out_segs_opt linked.
- Phase 1 GPU (G: bench, leased, turbo, tile 512, x2, denoise 0.3, `research/phase1.sh`): krea2 381 s, flux3 271 s,
  moss 398 s, qwen 757 s, all 2560x1600, people + face passes ran (log: 12 tile segments, 2 people, 4 face-pass segments).
  Identity holds at 1:1 on both faces (`out/p1_sheet.png`, `out/p1_sheet_crop.png`), no seam seen.
  klein / chroma / sdxl NOT RUN: base model files missing on the bench (qwen_3_4b + klein 4b unet, Chroma1-HD-Flash,
  SDXL_Realistic) - ComfyUI dropped Output_Image and "succeeded" in 0.7 s. Same node classes as the four that ran.
- Found on the bench: people boxes REMOVE whole tiles from the grid (24 predicted -> 12 sampled on the face photo), and
  BboxDetectorSEGS prints no "# of Detected SEGS". So the label/stage total (grid count) overstates when people are in the
  picture and the people/face bars are not known up front; the stage counter self-corrects up and `finish()` snaps.
- Klein 9B (Fabio 2026-10-23: the ONE model for shared graph changes): `phase1.sh klein_9b_t2i` 344 s, 2560x1600, 18 detailer
  segments (12 tiles + 2 people + 4 face-pass). Young man at 1:1 holds identity, a touch cleaner. Labels now "up to N tiles";
  desktop spec 1 passed, npm test 3533 pass / 0 fail, lint 0.
