# FLUX.3 Klein — model notes

> **What this is.** The FLUX.3 Klein *what*. `docs/playbooks/add-model/` is the generic *how*.
>
> Tracking card: MPI-1181. Every bench and decision with dates: the card's `brief.md`
> (sections "2026-10-19 update" and "Hand-back 2026-10-19"). Raw research: `tasks/MPI-1181/research/`.

Black Forest Labs, 5.6B, released 2026-10-15. Text-to-image and instruction editing with up to TEN
reference images in one model, plus bounding boxes in the prompt. One card (`flux3-klein`) with a
Turbo button; ships Klein's op set minus depth: t2i, i2i, edit, inpaint, detail, upscale.

| | |
|---|---|
| Licence | **FLUX Kommunity License v1.0** (`MODEL_LICENCES['flux3-klein']`, bundled `licences/flux3-klein/`). Model: non-commercial. Outputs: commercial only for a Qualifying User (under US$5M gross a year with affiliates). §2.e content filtering is a condition (the child-safety gate). HF-gated `auto`, so the gate proves access with the user's token (`verify` probes `workflows/README.md`). Not Klein 9B's agreement; different receipt |
| Engine floor | ComfyUI core **0.41.0** (native support, PR 17064); shipped on 0.42.1 |
| Transformers | BOTH install: distilled `flux3-image-klein-int8-convrot` 5.43 GB (Turbo on) and base `flux3-image-klein-base-int8-convrot` 5.41 GB (Turbo off). R2 primary, mirror `ml-resources/flux-3-image-klein-comfy` (ungated, same lfs sha256 as BFL's gated repo). No bf16 (double size), no nvfp4 (RTX 50 only) |
| Text encoder | **Reused** `qwen3vl-abliterated-clip` (Qwen3-VL-4B abliterated fp8_scaled, an engine asset) at CLIPLoader type `flux3`. BFL's own `qwen3vl_4b_int8_convrot` is not shipped |
| VAE | `vae-flux2` (shared) |
| Graph | ONE file, Klein's shape: `comfy_workflows/flux3_t2i.json`, raw `raw/flux3_t2i_template.json` (Fabio's bench `flux3.json`), generator `generate_flux3.py`. `Input_wf_type` 1 t2i, 2 i2i, 4 edit, 5 inpaint, 6 detail, 7 upscale (3 routes to t2i). Turbo = `Input_is_Turbo` -> MpiIfElse picks the UNET and steps (16/50) and cfg (1/3.5). References via `MpiFlux3References` (MpiNodes, `ref_image_0..9`, empties dropped, `<ref_image_N>` tags renumbered). Style rack, NSFW and depth LoRAs are bypassed in the raw, so the converter drops them |
| Settings | t2i er_sde/simple, base 50 steps cfg 3.5, Turbo 16 cfg 1; i2i er_sde/beta; edit euler/simple; inpaint LanPaint NumSteps 1 on VAEEncode of the crop; upscale single pass by default (tile = no prompt, cfg 1). The graph is the truth: Fabio confirmed it correct as wired 2026-10-19, where the brief's earlier table differs |
| Sizes | Tiers `1k` / `2k` (Qwen-Image 2.1's table) and `4k` = 2k x2 per edge (16:9 3840x2176, ~8.4 MP). Benched coherent at 4k on both weights: Turbo 130 s, base 681 s on a 16 GB card; the 4k radio carries a "slow" hint, never a cap |
| Custom edit size | Unmasked edit takes the ratio + tier picker (`customSizeOps: ['edit']`, `sizeOptIn` on the edit command) behind a **Custom size** button, off by default (`customSize` control, perOp, injects `Input_custom_size`). Off = follow reference 1: MpiPromptBox parks ratio + tier (hidden, not injected). Agent submit: a named `ratio`/`qualityTier` turns it on, else the project's button (`resolveNamedParams`). Never in opInject. The graph honours it only with no mask (#798 `custom size AND NOT has_mask`), so a masked edit keeps the source frame |
| Boxes | Settings button (`boxes` control, perOp; `layoutBoxes: { ops: ['t2i','edit'], format: 'flux3' }`), greyed on the other ops. `MpiBoxesDialog` draws over the output frame (blank at the ratio on t2i, picture 1 on an edit that keeps its frame). Boxes are fractions; `commandExecutor._buildParams` consumes `Layout_Boxes` and appends `Flux3LayoutPrompt`'s table (`withLayoutBoxes`, `js/data/layoutBoxes.js`) LAST, unless an Enhance already wrote one. NO box node in the graph. Bench 2026-10-20: boxes place subjects on t2i, swapping boxes swaps them; on edit an added object lands in its box, cited or not, simple or BFL i2i row shape alike |
| Speed (bench, 1024x1024 t2i, runtime file) | Turbo 12 s, base 48 s; edit (1 ref, 571x1021) Turbo 21 s; i2i Turbo 12 s |

## Hard rules

- **Never copy Klein 9B's "images stay commercially usable" line unqualified.** Here it holds only
  under US$5M revenue.
- **The prompt upsampler is required for good results** (BFL, Fabio's bench), and is NOT in the
  graph: the `flux-3` Enhancer recipe carries BFL's system prompts verbatim (`t2v` = BFL t2i, `i2i` =
  BFL i2i for edit/inpaint, `t2v_bbox` = BFL t2i_bbox for a t2i with Boxes; `research/bfl_pup_system_prompts.json`,
  Apache 2.0). BFL's i2i_bbox is NOT shipped: it boxes what is already in the pictures, which a
  description-reading enhancer can only guess; an edit with Boxes enhances in `i2i` and the app
  appends the user's table. The user presses
  Enhance; NO auto-run (Fabio, 2026-10-20), the op help says to. Cosmo's guide: `docs/agent/models/flux-3.md`.
- **Turbo on upscale is the user's call**, not forced (Fabio). Turbo single-pass upscale held identity
  best of every upscale run; tile upscale drifts identity.

## Sources

- <https://bfl.ai/blog/flux-3-image-klein>
- <https://huggingface.co/black-forest-labs/flux-3-image-klein-comfy> (gated; LICENSE.md ungated)
- <https://huggingface.co/black-forest-labs/flux-3-image-klein-pup> (upsampler + system prompts)
