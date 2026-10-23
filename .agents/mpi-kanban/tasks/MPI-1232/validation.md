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
- Phase 3 (2026-10-23, "Tile upscaler improvements 6"): names keyed by LABEL (plan.md Plan Drift). Static: scratch
  verify_labels.py - all 14 runtime graphs: MakeTileSEGS unfiltered -> SEGSLabelAssign(Input_Tile_Labels) -> SegsAndMask
  (inverted dilated person mask, dilation 30) -> tile detailer. tests/tile-describe.test.cjs 6 pass; npm test 3545 tests,
  3543 pass, 0 fail; lint 0; desktop prompt-box-use-tiles spec 1 passed.
- Phase 3 GPU (Klein 9B, leased, tile 512 x2, research/phase3verify.py): car (0.55) 24 tiles, 12 sampled + 12 skipped
  [empty mask], 2 people + 4 face segments; names (0.3) 349 s, 2560x1600, describer names in out/p3_klein_names.json.
  The car did NOT show (Klein turbo at 0.55 barely redraws a blurry court), so mapping proven instead by Impact's OWN code
  (wildcards.py + SEGSLabelAssign, scratch lab_check.py on the bench python): every sampled tile t0-5,10,11,16,17,22,23 gets
  its own name, 0 mismatches; the describer's people words ("man's head with sunglasses", "patterned shirt fabric") all sat
  on emptied tiles. The old [ASC] counter would have given t10 "man's head with sunglasses". Names run at 1:1: identity
  holds, no seam, nothing painted in (out/p3_klein_names_view.png).
- Phase 3 LIVE (app:isolated, Electron window, leased, klein-9b upscale tiles x2 @1024 via /connector/generate): 8/8 tiles
  named, sidecar Input_Tile_Labels t0..t7 + [CONCAT][LAB] prompts, 2560x1600 in 226 s, output clean at view size.
  First attempt from a browser-pane page: every comfy call Failed to fetch -> fallback held (warning toast, 0/8 named,
  run went on). Marker-name guard added after this run (cleanTileName).
- Phase 4: npm test 3546 tests, 3544 pass, 0 fail (agent-tiles tileSize cases, agent-loop "up to 40 tiles", budget
  16,394); lint 0; desktop prompt-box-use-tiles spec 1 passed.
- Close: code commit eeda0317e, pre-push lint + unit tests green, CI tests.yml run 39890042995 success; claim audit 28/28 proven.
