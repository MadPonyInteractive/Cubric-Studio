# MPI-1232 - Tile Prompt Flow

## Ask (Fabio, 2026-10-21)

A Flow that cuts the picture into tiles and redraws EACH tile with its OWN prompt, then stitches
them back. Upscale (factor > 1) or detail only (1.0x, or upscale then downscale back to the
source size). First logged as a "future" note on MPI-1181 (2026-10-19); no card existed until now.

## Why it is not the existing Use Tiles

The upscale op's **Use Tiles** (MPI-1038) is Impact `ImpactMakeTileSEGS` -> `DetailerForEachPipe`:
every tile goes through the sampler with the ONE prompt, so the prompt "applies per tile" and
renders the whole scene in each tile (`docs/models/krea2/upscaling.md` § traps). That is why
FLUX.3 locked tile upscale to no prompt, CFG 1.0 (MPI-1181 brief, 2026-10-19). A per-tile prompt
removes that trap: each tile is described for what is actually in it.

## Source recipe

Fabio has an old bench workflow that prompts per tile - **he is finding it**. Read how it splits,
prompts and blends before choosing a route. Do not design before it arrives unless he says so.

## Routes to compare (decide with Fabio)

1. **His workflow, as a graph.** One ComfyUI run; per-tile prompts injected as a list. Check how
   the count is bounded (tile count follows the OUTPUT size: 1920x1080 x2 = 15 tiles,
   `js/utils/tileCount.js`).
2. **The app makes the tiles.** The app crops N tiles (with overlap), runs one i2i/detail per tile
   through `enqueueGeneration` (each tile its own queue row, Stop works), then feather-blends them
   back (sharp). Model-agnostic, any installed model; costs N runs.
3. **Who writes each prompt:** the user types per tile (a tile-grid step gizmo, `docs/playbooks/add-flow/ui/`),
   and/or an auto caption per tile (Qwen3-VL is already an engine asset; Cosmo could also fill them).

## Known facts that constrain it

- Identity drift: overlapping tiles each re-denoise a face in turn; on FLUX.3 0.3 denoise already
  re-laid-out a face (MPI-1181 brief, tile run frpkh_00055). Per-tile prompts do not fix overlap
  re-denoise - the blend/order does.
- FLUX.3 prompts go through the BFL upsampler rules first (MPI-1181, DECIDED 2026-10-19).
- Big photos: 16K inputs and sharp's limits (`project_users_load_16k_images`, `tools/sharp.md`).
- A Flow is built with `/mpi-add-flow`; preview art with `/mpi-flow-graphics`.

## Related

MPI-1038 (Use Tiles, the prompt-less path), MPI-1181 (FLUX.3 tile bench + the original note),
MPI-1053 (Cosmo's upscale/detail routes - this Flow becomes one more), MPI-895 (upscale/refine
evaluation umbrella).
