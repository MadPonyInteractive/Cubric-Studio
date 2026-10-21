# MPI-1232 - Use Tiles, redone: a prompt per tile

## Ask (Fabio, 2026-10-21)

Not a Flow: this REPLACES the prompt box's **Use Tiles** (MPI-1038) on every model that has it.
Split the picture into tiles, redraw each tile with ITS OWN prompt on the SELECTED model, then
blend. Also a detailer (1.0x). Wanted: tiles whose seams never land on a face; cloud-shaped tiles
so no seam pass is needed. Fabio's old per-tile workflow is lost - design from what is below.
First logged as a note on MPI-1181 (2026-10-19).

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

- **Tile size option:** my pick = none. The tile is the model's own side (1024), the label already
  shows the count (`Upscale · N tiles`, MPI-1175). Revisit if a model wants another size.
- **Who writes the tile prompts:** my pick = auto-caption every tile; the prompt box text, if any,
  is appended to every tile as a style line (never a scene). A per-tile edit grid = later.
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
