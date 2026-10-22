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

2026-10-22 (Moss image 2): raw copied, weights on G:/models. Step 4 DONE by the agent on Fabio's explicit
go ("you can apply them yourself"): 7 nodes' `widgets_values` + `widgets_values_named` only, no wiring or
node changes; compact `ensure_ascii=False` dump round-trips the minified raw byte-identical (asserted before
write); a deep diff vs `comfy_workflows/raw/flux3_t2i_template.json` shows exactly those 16 values.
Step 5 running: `research/mossbench.py` (convert = `scripts/workflow-to-api.mjs` on the raw, needs :8188 up;
run = in-memory injects, `Input_wf_type` 1, 1024x1024). Bench = Fabio's G:\ComfyUi on :8188 (checked by
process command line, not the app's engine). Smoke: turbo text seed 1 = success, 31.5 s cold, text exact.
Injected input names are `int`/`string`/`boolean` (Mpi nodes), not `value`.
Run 1 (24 imgs, `bench/run1-unpruned/`): all success, text exact on every prompt, VRAM peak ~13.7 GB SFT /
~12.8 GB turbo. TIMES INVALID: the raw's rgthree Image Comparer (457, an output node) pulled the USDU upscale
branch (~22 s) into every run. Fixed: convert now applies `generate_klein._prune_to_captures` like the shipped
build (118 -> 111 nodes) and `run` waits for an empty queue + logs sampler bars from `/internal/logs`.
Run 2 (pruned) was queued behind peer MPI-1232's Krea2 lease, then stopped by Fabio for the handoff.
NEXT: `python -I research/mossbench.py convert` (bench must be up on :8188), then the matrix under
`gpu_lease.py run --poll 2 --timeout 3600 -- python -I .../mossbench.py run turbo turbo_euler sft sft_neg
--prompts text,long,photo --seeds 1,2`, backgrounded. Then numbers + verdict into validation.md (step 6).
2026-10-22: card picked up, plan written. FLUX.3 raw traced against the MOSS templates (swap
list below). M: cause found and fixed in MPI-1240 (a test helper deleted it).
Earlier note: M:/CubricModels found EMPTY (140 MB used of 1 TB; 40% used at 01:04 per the
"Release 2.1.2" session, M:\ root modified 01:45, recycle bin empty, no format). Reported to Fabio;
nothing written to M:. MOSS weights go to G:/models (bench test store), never M:.

Turbo (2026-10-22, Fabio asked): MOSS has NO official turbo - SFT and Base are both 25 steps CFG 2.5
(SFT = curated fine-tune, not distilled). Same size as Klein (5B, int8 5.4 GB each vs Klein 5.43/5.41), so
the Klein two-model shape fits. Community turbos, all Apache-2.0:
- `toxicdog/MOSS-Image-SFT-Turbo-INT8-ConvRot` - SFT merge, 5.41 GB, 8 steps CFG 1 no negative, ComfyUI-native,
  18k downloads. The one Prompt Mastery's video uses (youtube Jx1MDCmlYlg). On G:.
- `congruency/MOSS-Image-Turbo-MFD` - Mean Flow Distillation LoRA, 80 MB `.comfy.safetensors`, SFT + Base
  variants, 4-6 steps, v0.1, 828 downloads. On G:/models/loras/moss-image/. One model + LoRA saves 5.4 GB.
- darask0 / akhaliq / lodestones adapters: 1.2 GB LoRA + `time_embedding` + `dataspace` files (diffusers
  shape, not a plain LoRA) - skipped, core LoraLoader will not take the extra tensors.
Base checkpoint = bench A/B only (and later a LoRA-training base); not a shipping candidate.

Swap list (t2i group only; edit/depth/inpaint untouched, MOSS has no edit):
- 14 CLIPLoader -> `qwen3.5_9b_w4a8_gptq.safetensors`, type `moss_image`.
- 27 UNETLoader (turbo=true) -> `moss_image_sft_turbo_int8_convrot`; 646 steps 16 -> 8; 647 CFG stays 1;
  749 negative switch stays (turbo runs no negative - already right).
- 692 UNETLoader (turbo=false) -> `moss_image_sft_int8_convrot`; 734 steps 50 -> 25; 753 CFG 3.5 -> 2.5. No SLG (template: SLG on Base only).
- 738 KSampler stays er_sde/simple (shared by both branches; template SFT/Base = er_sde, turbo README = euler).
  Bench turbo on er_sde vs euler; add a sampler switch only if euler clearly wins. 762 is the i2i
  sampler (VAEEncode + denoise) - untouched.
- Shift: NO node. Core sets MOSS `shift: 5.0` in `comfy/supported_models.py` (class MOSSImage) and no
  official template has a shift node. The "Official Flow sigma shift" in Prompt Mastery's graph sits beside
  the OpenMOSS plugin's "MOSS-Image HF Loader" (diffusers loader, which we skip) at 5.00 = the core default.
  Add `ModelSamplingAuraFlow` only if the bench wants a higher shift at >1 MP.
- Negative: templates pass `nsfw, worst quality, bad anatomy, watermark, jpeg artifact` (node title "empty =
  reference default"). Bench SFT with empty vs that; never ship `nsfw` as a default negative.
- Templates' `TextGenerate` system prompt (9B TE as LLM) = how MOSS wants captions; read it for the Enhancer
  recipe at add-model time, do not copy the node.
- Turbo is NOT official (Fabio thought so 2026-10-22): OpenMOSS HF has only SFT + Base; toxicdog README says
  "experimental release", "modified version of MOSS-Image-SFT". Fabio's call stands: two models, no LoRA
  (LoRAs degraded Klein turbo).
- Bench variant (not saved in the raw): false branch = Base + `SkipLayerGuidanceDiTSimple` ('', '22', 0, 0.5)
  (template: SLG switch True on Base, False on SFT). MFD LoRA dropped (Fabio: two models); its files stay on G:.
- 38 NSFW LoRA + style rack stay bypassed (Fabio: kept set up for later). MOSS LoRAs exist already
  (axiomofmind nsfw-uncensored / beauty / gouache, Angais PixelArt) - survey at add-model time.
- 15 VAELoader: try our `flux2-vae` first; template uses `flux2-vae_small`.
- Boxes need no graph node: app-side `layoutBoxes` format `moss` building MOSSImageLayoutPrompt's JSON
  (`summary.caption`, items label/caption/text/palette, pixel yxyx centred, `bbox_coord_space: abs_centralized`).
- Template's TextGenerate enhancer (9B TE as LLM) not copied; the app's Enhancer is the house path.

## Completed

- 2026-10-22 (Moss image 2): step 1 - FLUX.3 raw copied byte-identical to `research/moss_image_t2i_template.json`.
  Swap-list node ids checked against the copy (all present; 38 NSFW LoRA already bypassed, 762 uses `beta` -> set `simple`).
- 2026-10-22: step 3 - 4 MOSS files downloaded to G:/models (bench yaml already scans G:/models/*).
  G: has no `flux2-vae.safetensors` and M: is empty, so node 15 takes `flux2-vae_small` for now.

## Remaining Work

Steps 1-6.

## Plan Drift

- 2026-10-22: weights go to G:/models, not M:/CubricModels (M: wiped, MPI-1240). Step 2's swap list lives in
  `## Current State` here, not a separate `research/node-swaps.md`.
