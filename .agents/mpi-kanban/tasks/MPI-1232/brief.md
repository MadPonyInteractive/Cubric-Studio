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

## Related

MPI-1038 (Use Tiles today), MPI-1175 (tile count in the label), MPI-1181 (FLUX.3 tile bench +
identity drift), MPI-1101 (Make seamless machinery), MPI-1053 (Cosmo's upscale routes - update
the Use Tiles line), MPI-895 (upscale/refine umbrella).
