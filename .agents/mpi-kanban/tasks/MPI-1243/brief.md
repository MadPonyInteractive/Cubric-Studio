# MPI-1243 - Add MOSS-Image (turbo + SFT) on the FLUX.3 setup

Fabio approved 2026-10-22 ("we're definitely going to add this model. The images look good").
Evidence: `.agents/mpi-kanban/tasks/MPI-1180/validation.md` + `research/bench/run2_grid.jpg`.

## Start from

- Raw: `.agents/mpi-kanban/tasks/MPI-1180/research/moss_image_t2i_template.json` - the shipped FLUX.3 raw with 7
  nodes' values swapped (swap list in MPI-1180 `plan.md` § Current State). FLUX.3 is already set up for boxes and the
  rest, so few changes are needed (Fabio). Run `/mpi-add-model`; it owns the playbook.
- Bench driver for re-checks: MPI-1180 `research/mossbench.py` (convert + run, under `gpu_lease.py run --poll 2`).

## Shape

- Two models like Klein: turbo = `toxicdog/MOSS-Image-SFT-Turbo-INT8-ConvRot` (community, Apache-2.0,
  "experimental", NOT official), 8 steps, CFG 1, sampler `euler` (same quality as er_sde, slightly faster), no negative;
  SFT = official OpenMOSS SFT int8, 25 steps, CFG 2.5, er_sde, EMPTY negative (never `nsfw` as a default).
- Text encoder `qwen3.5_9b_w4a8_gptq` (CLIPLoader type `moss_image`); VAE `flux2-vae_small` on the bench (try ours).
- No shift node (core sets MOSS shift 5.0). Boxes: app-side `layoutBoxes` format `moss` (MOSSImageLayoutPrompt JSON).
- Weights are on G:/models (bench store), not yet on R2 / M:.

## Open checks (fold in, from the bench and the video research)

- 8 GB card (warm peak ~7-8 GB, cold ~12.2 GB with the 9B TE resident); per-process RAM (bench only read whole-box).
- CFG 3.0 vs 2.5 on SFT; 2 MP and 4 MP; a small-text prompt (the video showed small infographic text misspelled).
- Spectrum MOSS speed node (`Rkkss/ComfyUI-Spectrum-MOSS`, GPL-3.0, claims 2-2.5x on SFT only): A/B once; GPL means a
  licence check before it could ship.
- Ideas from the video (youtube 3g-dbIEa3II): "boxes from picture" (a vision model writes a multi-box MOSS layout from an
  image, then MOSS regenerates - re-composition, not pixel editing) and a box that carries exact words to render.
  REUSE what we ship: `qwen3vl-abliterated-clip` (Qwen3-VL-4B abliterated, engine asset) and the describe graph's
  `boxFromDescribeAnswer` mapping (`docs/llm.md`); do not add another VL model. Node-code tips: greedy decoding, no
  repetition penalty. The AcademiaSD layout node has no licence: ideas only, no code.
