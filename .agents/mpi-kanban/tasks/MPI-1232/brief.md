# MPI-1232 - Use Tiles, redone: a prompt per tile

## Ask (Fabio, 2026-10-21)

Not a Flow: this REPLACES the prompt box's **Use Tiles** (MPI-1038) on every model that has it.
Split the picture into tiles, redraw each tile with ITS OWN prompt on the SELECTED model, then
blend. Also a detailer (1.0x). Wanted: tiles whose seams never land on a face; cloud-shaped tiles
so no seam pass is needed. Fabio's old per-tile workflow is lost - design from what is below.
First logged as a note on MPI-1181 (2026-10-19).

## Decisions (Fabio, 2026-10-21)

- **Target 2.1.3 or later - NOT 2.1.2.** Nothing is wired until the bench passes.
- **Use Grid goes.** With a prompt per tile, Tiles covers what Grid did; one upscale split option.
- **Use Tiles, when on, shows two more controls:** a **Tile size** (injected straight into
  `ImpactMakeTileSEGS` `bbox_size`) and a **Describe each tile** toggle (on = every tile gets its own
  caption via the wildcard; off = today's prompt-less tiles).

### What the decisions pull in (check while planning)

- **Tile size = `ImpactMakeTileSEGS` `bbox_size`** (Fabio). Offered 256 / 512 / 768 / 1024 / 1536,
  **default 1024**. The count shows live in the label (`tileCount.js` takes the size). Use cases:
  a 1024x1024 detail at 1.0 gets ONE tile today (bbox clamps to the short side) - Fabio wants ~4;
  a 3K picture he wants in ~4 big tiles.
- **Real counts are higher than size alone suggests** - overlap + the cloud-mask padding (+22 px)
  eat each step (`tileCount.js`, 2026-10-21, factor 1.0):

  | picture | overlap | 256 | 512 | 768 | 1024 | 1536 |
  |---|---|---|---|---|---|---|
  | 1024x1024 | 200 fixed (today) | 49 | 16 | 4 | 1 | 1 |
  | 1024x1024 | 20% of tile | 25 | 9 | 4 | 1 | 1 |
  | 3072x2048 | 200 fixed | 294 | 70 | 24 | 12 | 6 |
  | 3072x2048 | 20% of tile | 140 | 40 | 20 | 12 | 6 |

  So 512 on 1024 is 16 (4x4), not 4; ~4 tiles on 1024 = 768. **Overlap is DYNAMIC** (Fabio
  2026-10-21: 200 works at 1024, scale it from the tile size); a fixed 200 is 78% of a 256 tile.
  Bench ~20% of the tile, floor it so the cloud mask still has room; `tileCount.js` takes the
  same rule so the label stays exact.
- **Tile size is picked in PIXELS, with the live count** (Fabio: "whichever is more accurate").
  A grid ("2x2") cannot be honoured: Impact tiles are SQUARE, so a 3072x2048 at 1536 is 3x2,
  and the px is the node's own value - exact by construction.
- **The describer sees the WHOLE picture, not just the tile** (Fabio 2026-10-21). A tile alone is
  often unreadable: on his "Flux 3 tests" UFO picture (`upscale_002`, 6048x3456 after
  t2i -> upscale -> detail -> upscale) the grass + trees field left of the people, under the UFO,
  went to mush over repeated prompt-less tile passes - the model has no idea what it is.
  `describeImage` takes ONE image + an optional `crop` (`llmService.js:1122`), so the cheap route:
  caption the whole picture ONCE, then ask per tile with that caption + the tile's place
  ("lower left") as CONTEXT and "describe only what is inside this crop". Context names the
  thing; the answer must not carry the whole scene in (the Make seamless 16K trap). Alternative:
  one image = the whole picture with the tile outlined. Bench both on the UFO picture's field.
- **The detailer's guide follows the tile.** `DetailerForEachPipe` guide 1024 (bbox) / max 1536:
  a small tile is ENLARGED to 1024 to sample (256 -> 4x = the extra detail Fabio wants), but a
  1536 tile is SHRUNK to 1024 to sample and pasted back soft. Guide = max(1024, tile), max size
  to match, per model.
- **Removing Grid touches:** every template's Grid path (`MpiGridDimensions`, `Input_*` grid ids),
  `PromptBoxControls.js`, `promptControlDefaults.js`, `generationControls.js`, `commandRegistry.js`,
  `generationService.js`, plus the agent's upscale routes (MPI-1053) and the MCP/Cosmo params.
- **Old saved settings still say `useGrid`:** reuse from an old card (`promptReuse.js`,
  `projectModel.js`) and saved Routines (global, MPI-970) must map it to Tiles or drop it, never
  fail or silently run a plain upscale.
- **Describe off keeps the one-prompt trap** (the box text runs in every tile) - keep today's
  rule for it (no prompt, CFG 1 on FLUX.3), and say so in the toggle's hover.

## Findings (2026-10-21, read from the Impact Pack source on the G:\ComfyUi bench)

1. **Tiles already run one at a time, and are already clouds.** `DetailerForEachPipe` loops the
   SEGS and samples + pastes each tile in turn (`impact_pack.py` ~:340-385), so tile N sees tiles
   1..N-1 already redrawn. `ImpactMakeTileSEGS` `mask_irregularity 0.7` "Reuse fast" (our graph) is
   the cloud mask - why Use Tiles shows no seams today (`docs/models/krea2/upscaling.md`). The ONLY
   real gap is that every tile gets the ONE prompt -> FLUX.3 had to lock tiles to no prompt.
2. **Impact already takes a prompt per tile.** `DetailerForEachPipe` has a `wildcard` input:
   `[ASC]tile 1 text[SEP]tile 2 text[SEP]...` gives each tile its own prompt, in tile order
   (ASC = sorted by bbox x1, then y1). `[SKIP]` leaves a tile untouched, `[STOP]` ends the run.
   No new node, no second graph, no N dispatches.
3. **Trap - the wildcard REPLACES the conditioning** (`core.enhance_detail` ~:267): it is a plain
   clip encode, so anything our graph adds to `positive` (Flux guidance, ReferenceLatent) is
   dropped. `[CONCAT]` keeps the base positive's dict and appends the tile text. Bench which works
   per model family before wiring.
4. **Faces:** `face_yolov8n.pt` already ships (`assetDeps.js`). `ImpactMakeTileSEGS` takes
   `filter_out_segs_opt` (an exclusion mask, dilated) - feed it the face SEGS so grid tiles leave
   faces alone, then redraw each face ONCE as its own whole tile. That also fixes MPI-1181's
   identity drift (3-4 overlapping tiles each re-denoising one face).
5. **The app can make the tiles too** - Make seamless (MPI-1101) already has it:
   `services/seamlessOps.js` (lossless working copy, window plan, cut + mask, feathered paste),
   flowService multi-pass with `tool:hold` (status bar i/N between passes), and a per-window
   describer (`everyPass`). Its 16K lesson: a whole-scene prompt makes the model paint the whole
   scene into every window - the exact reason per-tile prompts matter.

## Plan options (Fabio's call)

- **A (recommended) - stay in the graph.** App ports `js/utils/tileCount.js` to return the tile
  RECTS (same maths as `ImpactMakeTileSEGS`), crops each tile from the scaled picture, captions each
  with the describer, joins them `[ASC]...[SEP]...` into one new `Input_Tile_Prompts` string ->
  the Tiles group's wildcard. One queue row, one run, clouds keep seams away, no seam pass.
- **B - app-side tiling** on the Make seamless machinery: one queue row per tile, each a normal
  i2i/detail op on the selected model, pasted with a cloud alpha. More control (retry one tile,
  show each tile's prompt live) but N dispatches, and multi-pass lives in flowService, not the
  prompt box. Only if A fails the bench.

## Open questions

- ~~Tile size option~~ - DECIDED (above): px + live count, dynamic overlap. Open: the overlap rule.
- **People pass (Fabio's old workflow, from memory):** two passes - a BACKGROUND pass whose tiles
  have the people SUBTRACTED, and a PEOPLE pass. Matches finding 4: `filter_out_segs_opt` on
  `ImpactMakeTileSEGS` = the subtraction; `person_yolov8n-seg.pt` (ships) or `face_yolov8n.pt`
  for the people pass. Bench: whole person vs face only (a full-body person bigger than the guide
  is sampled shrunk).
- **With Describe on, what the box text does:** my pick = appended to every tile as a style line
  (never a scene). A per-tile edit grid = later.
- **Caption cost/time:** 1920x1080 x2 = 15 tiles, 4000x6000 x2 = 150 captions. Local describer
  (time) or the DeepInfra one (money) - price it before a big photo runs.
- **Face pass order:** faces inside the same DetailerForEach (one SEGS list) or a second detailer
  after the grid. The wildcard order must still match the tiles either way.
- **FLUX.3:** its prompts go through the BFL upsampler rules (MPI-1181, DECIDED 2026-10-19) -
  does that apply per tile?

## Bench before building (Fabio's GPU go)

Krea 2 + FLUX.3 Klein, one photo with faces at 2x: today's prompt-less tiles vs per-tile
`[ASC]` (replace) vs `[CONCAT]`, with and without the face exclusion. Eye-check faces and the
overlap areas at 1:1.

**DECIDED (Fabio, 2026-10-22, stage 1 sheets):** base vs turbo - no real difference (bench and ship tile runs on
turbo); faces on slightly better than off -> the face pass ships. Per-tile prompts are judged in stage 2 (UFO field).

## Stage 1 results (2026-10-22, turbo on)

Sheets: `research/out/sheets/<model>_<region>.png` (input | A B C faces off | A B C faces on, 1:1).

- **Krea 2 (6/6):** no seams; identity holds everywhere. B/C a touch crisper than A. Faces ON clearly better
  (young man soft in f0, sharp and true in f1). ~200-255 s per run.
- **FLUX.3 Turbo (6/6):** faces OFF all three bad - dotted-mesh beard, painted face, B/C add wet blotches on the
  cheek (= MPI-1181's "Turbo tile upscale: bad"). Faces ON rescues every variant: no mesh, no blotches, both faces
  close to the input. The faces-off damage is each face re-denoised across 3-4 overlapping tiles. ~165-185 s.
- **FLUX.3 base (turbo off), A/B faces on:** about the same as turbo faces on, a touch softer, ~240 s. Not worth it.
- **My read for the decision:** the face pass (face SEGS subtracted from the grid + one face redraw) is the win on
  both models and should ship with Describe on or off. Per-tile prompts: small gain on Krea 2, none visible on
  FLUX.3 once faces are on; B vs C no clear difference on this photo - stage 2 (the UFO field, where a tile alone
  is unreadable) is where the prompt has to earn its place.

## Stage 2 results (2026-10-22, Krea 2 turbo, face pass on, UFO field)

Input: `upscale_002` crop (0,1450)-(1344,2450) = the hazy valley left of the people (`research/input_field.png`),
2x = 12 tiles. Original t2i_004 shows it was "a dim patchwork of fields fading into evening haze" (its own prompt,
`research/prompt_t2i_004.txt`); by upscale_002 it is mush. Captions: the app's describer graph
(`image_descriptor.json`, qwen3vl 4B) on the bench, `research/captions_field_<m>.json`. Sheets:
`research/out/sheets/field_whole.png` (whole crop, downscaled) + `field_field.png` / `field_edge.png` (1:1).

- **Captions, all four methods fail to name the field.** 1 tile alone and 2 tile + whole-picture caption: "blurry,
  pixelated noise / underwater / corrupted data". 3 whole picture with the tile outlined: names THINGS, but wrong
  ones ("dark ocean", "cliff face", "stormy clouds"). 4 tile + the card's own t2i prompt as context: still "blurry,
  grainy" - the 4B anchors on the pixels and ignores the context. No method carried the UFO or people in. Even the
  whole-picture caption never mentions the valley.
- **Denoise 0.2 (shipped): the tile prompt does NOTHING.** A, cap1, cap3 and a hand-written correct ("oracle")
  caption all come back equal to the input. Describer quality is moot at 0.2.
- **Denoise 0.45: the tile prompt decides the content.** A (no prompt) invents rippled water; oracle paints farm
  fields with hedgerows (right thing, too close/flat, no haze); cap3 ("ocean/cliff") paints a rock cliff. Seams
  start to show at 0.45 (vertical striations on a tile edge in cap3, a hard band at the top in oracle).
- **Read:** per-tile prompts only matter where denoise is high enough to repaint, and there a WRONG caption is
  worse than none. The local 4B describer cannot recover content a picture has lost; the card's own prompt is the
  only true source, and the 4B would not use it as context. Fabio's mush came from repeated prompt-less passes.
  ~270-300 s per run.
- **Method 5 (Fabio 2026-10-22): the outline + "using the whole scene as a clue, what real thing fills that area,
  how would it look sharp; never call it blurry".** Captions jump: 4B ~5/12 "valley", 5 "cliff", 1 "sea"; 8B
  (`qwen3vl_8b_int8_convrot`, `DESCRIBER=` env) 8/12 "misty valley / layered hills / trees", 3 "mossy ground" (the
  bottom tiles, which hold the grass strip). Redrawn at 0.45 (`out/sheets/field_whole_d45.png`): BOTH still fail.
  8B painted a small UFO with a beam into the valley (its captions said "lit by the UFO's beam") + floating pebbles;
  4B made a patchwork (rock mass, grass, hills, one per tile). The oracle is coherent only because every tile got
  the SAME caption. **The blocker at 0.45 is tiles that disagree**: 12 overlapping tiles, 12 ideas, vertical seams.
  32B not tried: 26 GB on a 16 GB card.
- **Fabio's rule (2026-10-22): a detail prompt NAMES the thing in a few words** ("a field with green grass"); detail
  words make it hallucinate. A short prompt is a steer: he masks a face + "Asian woman" to change ethnicity. So the
  face pass stays prompt-less unless the user writes one (a describer's face guess would steer identity).
  Method 6 = the outline + "name what fills it in five words or fewer".
- **Method 6 results (short names, 0.45, `out/sheets/field_whole_short.png`):** NO hallucinated objects (no UFO, no
  pebbles) on 4B or 8B - Fabio's rule holds. But the names are wrong and the content follows them: 4B "stormy
  ocean / cliff face / stormy sky" -> a fog-and-rock mass; 8B "foggy valley below cliff" x6 -> fog, not fields. Only the
  oracle ("patchwork of fields") made fields. On an already-mushed picture the small describers cannot name what
  was there. Not yet tested: a READABLE picture (a fresh t2i upscaled once), the real use case. The run right after
  the 8B describer took 780 s (vs ~300): likely memory left behind by the 8B.
- **Readable picture (t2i_004 untouched, 1344x768 -> 2x, 8 tiles, Krea 2 turbo, face pass on, 0.35;
  `out/sheets/fresh_whole.png` + `fresh_crops.png`):** 4B short names were scene-level ("UFO hovering over cliff",
  "five people standing on cliff edge", "cloudy sky with sunset hues") - tiles of 1068 px cover big chunks. Neither
  run added a UFO or people. Field: no prompt washed the farm patchwork into haze and stretched the UFO beam into a
  long streak; names kept more hedgerow lines and the beam near the input (both softer than the input). People: no
  prompt kept everyone; names turned the grey-haired man brown-haired (the face pass misses backs of heads). UFO: both
  fine. Mixed: names help the far field, cost one hair colour. ~200-210 s per run.
- **Names + people (method 7, Fabio: scenery in a few words, people by hair + clothing; `out/sheets/fresh_people.png`):**
  the 4B contradicted itself across overlapping tiles - "grey-haired man in navy hoodie" in one, "bald man in navy
  hoodie" in another, the main people tile still just "five people standing on cliff edge", and one tile listed
  people outside its box. Result: the grey-haired man came out BALDING (short names: brown-haired; no prompt: grey,
  the best). Field = as short names (better than no prompt). People words steer, but to the describer's mistakes too.
  Candidate: people leave the grid like faces (stage 3's `person_yolov8n-seg` subtraction) and get a prompt-less
  pass, while scenery tiles keep short names.
- **Stage 3 people pass (Fabio's go, t2i_004 2x, 0.35; `out/sheets/fresh_peoplepass.png`, `fresh_greyman.png`):**
  person boxes (`bbox/person_yolov8n-seg.pt` via BboxDetectorSEGS, crop 1.5) subtracted from the grid + one prompt-less
  DetailerForEachPipe over them (`tilebench.py ... faces=2`). Boxes, not silhouettes: the app ships the model under
  `ultralytics/bbox/` (assetDeps.js:994) and the Impact Subpack only gives a SEGM detector for a model in `segm/`
  (SegmDetectorSEGS died on NO_SEGM_DETECTOR); silhouettes = moving that dep. Scenery-only names (method 8, "ignoring
  any people"): "rocky cliff edge", "cloudy sky with sunset hues", "UFO hovering over landscape" - no people words.
  Grey-haired man: no prompt + face pass = grey (best); short names = brown; names + people = balding; people pass
  = grey, a touch darker; people pass + scenery names = dark grey. The people pass keeps describer mistakes off
  people; the whole-person redraw at 0.35 darkens slightly. Field keeps the scenery-name gain. ~215-230 s per run.
- **Fabio's denoise bands (2026-10-22):** 0.2 ~nothing on a high-res picture (only a low-res one shows it);
  0.3-0.45 slight changes (detail); >0.65-0.7 inpainting/recreate; >0.75-0.8 foreign content. Trial and error per
  model. Open for wiring: Tiles' 0.2 default does ~nothing on a big picture - default 0.3, or scale it by the
  input's resolution? (Fabio's call.)

## Related

MPI-1038 (Use Tiles today), MPI-1175 (tile count in the label), MPI-1181 (FLUX.3 tile bench +
identity drift), MPI-1101 (Make seamless machinery), MPI-1053 (Cosmo's upscale routes - update
the Use Tiles line), MPI-895 (upscale/refine umbrella).
