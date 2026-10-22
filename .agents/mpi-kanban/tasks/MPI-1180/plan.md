# MPI-1180 plan - bench MOSS-Image locally

## Goal

A wire-or-drop verdict in `validation.md` with measured numbers (brief "What to measure").
Local bench first (G:\ComfyUi, v0.42.1, RTX 4060 Ti 16 GB, 64 GB RAM). Pod only after Fabio
approves a price.

## Rule (MPI-936 lesson, Fabio 2026-10-22)

The MOSS graph is a COPY of the shipped FLUX.3 raw (`comfy_workflows/raw/flux3_t2i_template.json`),
the only model with bounding boxes. Loaders and settings are swapped IN PLACE in ComfyUI by Fabio,
from a node-swap list the agent writes. No script-built graph, no official template shipped, no
API graph converted back. Official MOSS templates are reference only (which nodes, which wires).

## Steps

1. Copy the FLUX.3 raw to `research/moss_image_t2i_template.json` (plain copy, untouched).
2. Read FLUX.3 raw vs the core MOSS templates (`image_moss_image_t2i*.json`) and write
   `research/node-swaps.md`: each node to swap, its MOSS replacement, wires, widget values.
3. Download weights to `M:/CubricModels` (SFT + Base int8, Qwen3.5-9B w4a8 TE, flux2-vae_small
   only if our flux2-vae fails).
4. Fabio applies the swaps in G:\ComfyUi and saves over the research copy.
5. Bench under `gpu_lease.py run`: s/img, peak VRAM, peak RAM, text rendering, long prompt,
   boxes steering, Base vs SFT. Results in `research/bench/`.
6. Verdict in `validation.md`. Wire = open an `/mpi-add-model` card that starts from this raw.

Ownership: `.agents/mpi-kanban/tasks/MPI-1180/` only. Nothing in `comfy_workflows/` or `js/` until
the verdict opens the add-model card.

## Verification

**Verify mode:** user-ux (Fabio reads the graph; image quality is his eye).

## Current State

2026-10-22: card picked up, plan written. FLUX.3 raw traced against the MOSS templates (swap
list below). M: cause found and fixed in MPI-1240 (a test helper deleted it). NEXT: download the MOSS files to
G:/models (step 3), then hand Fabio the swap list below as nodes to change in ComfyUI.
Earlier note: M:/CubricModels found EMPTY (140 MB used of 1 TB; 40% used at 01:04 per the
"Release 2.1.2" session, M:\ root modified 01:45, recycle bin empty, no format). Reported to Fabio;
nothing written to M:. MOSS weights go to G:/models (bench test store), never M:.

Swap list draft (t2i group only; edit/depth/inpaint untouched, MOSS has no edit):
- 14 CLIPLoader -> `qwen3.5_9b_w4a8_gptq.safetensors`, type `moss_image`.
- 27 UNETLoader (turbo=true branch) -> `moss_image_sft_int8_convrot`; 692 (false) -> `moss_image_base_int8_convrot`.
  Bench reads Input_is_Turbo as SFT/Base.
- Base only: add `SkipLayerGuidanceDiTSimple` ('', '22', 0, 0.5) between 692 and 689.false (template: SLG on for Base).
- Steps 646/734 -> 25, CFG 647/753 -> 2.5 (template defaults, both checkpoints).
- 749 negative switch zeroes the negative when turbo=true: wire 751 straight into 738/762 negative (SFT runs CFG).
- Bypass 38 NSFW LoRA + style rack (Klein-4B LoRAs, wrong arch). Style-LoRA survey for MOSS later.
- 15 VAELoader: try our `flux2-vae` first; template uses `flux2-vae_small`.
- Boxes need no graph node: app-side `layoutBoxes` format `moss` building MOSSImageLayoutPrompt's JSON
  (`summary.caption`, items label/caption/text/palette, pixel yxyx centred, `bbox_coord_space: abs_centralized`).
- Template's TextGenerate enhancer (9B TE as LLM) not copied; the app's Enhancer is the house path.

## Completed

## Remaining Work

Steps 1-6.

## Plan Drift
