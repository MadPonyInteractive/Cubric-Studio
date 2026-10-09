# Tile Detailer (MPI-1038)

One image in, the same picture back with more detail, and bigger when the user asks. A
DETAILER first, an upscaler second (Fabio, 2026-10-08): the optional upscale runs BEFORE the
detail pass, and None is detail only. Recipe = Fabio's bench "Flow Tile Detailer"
(MPI-623 `validation.md` § Super upscaler), minus its 360 pad and AnimeSharp tail.

| | |
|---|---|
| id / op | `tile-detailer` / `flowTileDetailer` |
| graph | `comfy_workflows/flow_tile_detailer.json` (raw: `raw/flow_tile_detailer.json`) |
| models | `[['klein-9b']]`: Klein 9B int8 + Qwen3 8B + Flux2 VAE baked, nothing injected. No cloud model |
| deps | none beyond the model (Impact Pack is in the engine pin) |
| steps | none: inputs, then Generate |
| controls | `Input_Upscale_Factor` radio 1 / 1.5 / 2, `Input_Denoise` slider 0.15-0.60, optional `positive` |

## The graph

`Input_Image` -> `ImageScaleBy` lanczos x `Input_Upscale_Factor` -> `ImpactMakeTileSEGS`
(bbox 1024, crop_factor 1.5, min_overlap 200, dilation 30, mask_irregularity 0.7, Reuse fast)
-> `DetailerForEachPipe` (Klein 9B, 4 steps lcm/normal, cfg 1, `Input_Denoise`, feather 10,
force_inpaint, guide_size 1024 / max_size 1536) -> `Output_Image`. Factor 1 is a true no-op
(PIL returns a same-size resize untouched). `tests/inject-params-titles.test.cjs` pins the
order: tiles and detailer both read the SCALED image.

**guide_size 1024, not the bench's 64.** Denoise is relative to the working size. Fabio's
recipe always fed 1024 tiles, so 64 (the detailer's own upscale off) never mattered there; but
detail-only on a small picture sampled it at its own size, and at 0.35 an 800x533 photo came
back with its benches and paving redrawn (drift max 44). At 1024 a tile under 1024 is sampled
at ~1 MP and scaled back (drift max 29, shapes kept); a 1536 crop of a 1024 tile still runs
natively, so VRAM is unchanged. Evidence: `.agents/mpi-kanban/tasks/MPI-1038/validation.md`.

**Why Impact tiles and not the prompt box's Klein Upscale (Ultimate SD Upscale).** The tiles
overlap by 200 px with irregular masks and 1.5x context each, so no tile grid shows; Fabio
judged it far crisper than any model-only upscale. The Klein Upscale op stays for a plain
re-render at a bigger size.

**0.35 is the default because Fabio's eye set it**: 0.45 already redraws content (on the
bench, ILL SDXL at 0.46 turned a house into rocks; Klein at 0.35 kept houses, well and palette,
drift 3x lower and no tile grid in the drift map).

## Traps

- **The prompt is sampled on EVERY tile.** A scene prompt draws the scene into flat sky
  (MPI-623's tiled Krea refine ghosted villages across the sky). The field asks for the look
  ("2D flat shader, cartoon") and defaults empty. `docs/agent/flows.md` tells Cosmo the same.
- **Not a 360 graph.** The tiles do not wrap, so a pano's left and right edges are detailed
  apart and the seam re-opens. The wrap pad alone leaves a tone step and a cross-fade ghosts
  (MPI-623), so 360 support waits for the 360 Flow's cut-merge node.
- **The raw graph was written once by a script** from `/object_info` (a plain LiteGraph file,
  with a read-me Note on the canvas); edit it in ComfyUI from here on. `sync-raw-workflows.mjs`
  was not run for it, because a peer's uncommitted raw file in the shared tree would have been
  committed along with it. The runtime file is the converter's output (`workflow-to-api.mjs` +
  `validate-injection-rules.mjs`), byte-identical to the graph proven on the bench.
