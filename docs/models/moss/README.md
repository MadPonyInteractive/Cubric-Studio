# MOSS-Image — model notes

> **What this is.** The MOSS-Image *what*. `docs/playbooks/add-model/` is the generic *how*.
>
> Wiring card: MPI-1243. Bench, numbers and verdict: MPI-1180 `validation.md` (raw research in
> `tasks/MPI-1180/research/`, VAE A/B in `tasks/MPI-1243/research/`).

OpenMOSS, 5B, a text-to-image model (upstream has no reference edit). Its strength is exact
lettering and long prompts: every text line in the bench came out spelled as written. One card
(`moss-image`) with a Turbo button: t2i, plus i2i, inpaint, detail and upscale on FLUX.3's own
graph branches (Fabio, 2026-10-22). No `edit`: nothing in MOSS reads a reference picture.

| | |
|---|---|
| Licence | Apache-2.0 (OpenMOSS weights, Comfy-Org repack, toxicdog Turbo). No licence gate |
| Engine floor | ComfyUI core with PR 17095 + 17099 (native MOSS), shipped in 0.42.1 |
| Transformers | BOTH install. Turbo on = `moss-image-turbo-transformer` (toxicdog SFT-Turbo int8_convrot, a COMMUNITY merge, "experimental"; 8 steps, cfg 1, no negative). Turbo off = `moss-image-sft-transformer` (official SFT int8_convrot, 25 steps, cfg 3 + layer skip). Base is not shipped |
| Text encoder | `moss-image-qwen35-9b-clip` (Qwen3.5-9B w4a8 GPTQ, 6.84 GB) at CLIPLoader type `moss_image`. Not the Qwen3-VL 4B FLUX.3 uses |
| VAE | `vae-flux2` (shared). The bench's `flux2-vae_small` decodes the same picture (43 dB PSNR, 2026-10-22) |
| Graph | A copy of FLUX.3's raw with the t2i loaders and settings swapped: `raw/moss_t2i_template.json` -> `generate_moss.py` -> `comfy_workflows/moss_t2i.json`. `Input_wf_type` 1 t2i, 2 i2i, 5 inpaint, 6 detail, 7 upscale, all on the one UNET pair; FLUX.3's edit branch (4) stays in the graph unreached (validated, hence FLUX.3's node packs and upscaler in the deps). Inpaint keeps FLUX.3's `MpiFlux3References` conditioning: core `MOSSImage.extra_conds` reads only `cross_attn`, so the reference latents are ignored and it is the plain prompt. No shift node: core sets MOSS shift 5.0 |
| Settings | Shared t2i KSampler `er_sde`/`simple` for both weights. Euler was tried for both (MPI-1249) and lost on Fabio's eye: on Turbo it merged buildings and flattened depth, and SFT on euler re-composed rather than improved. SFT runs 25 steps, cfg 3 (was 2.5) and a `SkipLayerGuidanceDiTSimple` (single block 22, 0-0.5) on the t2i sampler's model: the OpenMOSS card's cfg and skip at half its 50 steps, because 50 steps gave a near-identical picture at twice the time (MPI-1249 `research/bench/sft_ab_sheet.jpg`, `sft_sampler_sheet.jpg`). The skip only touches the uncond pass, so Turbo (cfg 1, no uncond) renders pixel-identical with or without it; i2i/inpaint share the cfg 3 but not the skip. i2i (`er_sde`/`beta`) and inpaint (LanPaint) take the t2i steps (8 / 25); detail and upscale take FLUX.3's `MpiMath` steps `8 if a else 15` |
| Progress | No `progressStages` entry: detail and upscale vary the bar count, so `single: 1` would read "Stage 3/1" (same as FLUX.3 and Chroma) |
| Boxes | `layoutBoxes: { ops: ['t2i'], format: 'moss' }`. The app replaces the prompt with what core `MOSSImageLayoutPrompt` builds (`mossLayoutPrompt`, `js/data/layoutBoxes.js`): `summary.caption` = the prompt, one `object` item per box, pixel `yxyx` edges centred on the frame. A `<name>` in the prompt reads as the name in words. No box node in the graph. Text and character labels are not offered yet |
| Resolution | Trained to ~1 MP: the final stage "caps target image area at" 1024² (tech report arXiv 2610.23374 § 3.3), multiples of 16. The USERGUIDE recommends 1, 1.5 or 2 MP and calls the rest extrapolation; its own examples use 1456x1456. The `2k` tier (FLUX.3's 1472², 1920x1088, ~2.1 MP) bent limbs in Fabio's renders, 1K was clean, so on 2026-10-22 MOSS went 1K only (no tier radio, orientation mode); bigger = the upscale op |
| Style LoRAs | MPI-1249, Krea2 pattern (`MpiStyleLoras` rack + `Input_Style_Selector`). Anime, Gouache, Psychedelic Pop (axiomofmind, the authors' `-ComfyUI` files) and Pixel Art (Angais, re-keyed here: the repo's bare `layers.N` keys load nothing), all Apache-2.0. Triggers `moss_seinen_style`, `moss_vgouache_style`, `moss_psychpop_style`, `pixel art 16x16 game icon`, appended after the prompt with `", "`. Deps `moss-style-*` in `loraDeps.js`; previews `display/moss-style-*.webp`, made on Turbo. Turbo is the better pairing (Fabio). Pixel Art was trained on 512² icons on magenta, yet a full 1 MP scene came out clean. SFT patches 168 layers (fused `qkv`), Turbo 252 |
| Speed (bench, 1024x1024, 16 GB card) | Turbo ~6 s sampler, ~11 s per image; SFT ~27 s sampler, ~31 s per image. Peak VRAM ~7-8 GB with the encoder cached, ~12.2 GB cold |

## Hard rules

- **Never default a negative of `nsfw, ...`** (the official templates' default). SFT ships with an
  empty negative: the bench showed no difference with it.
- **Turbo is not official.** Say "community Turbo" wherever the source matters.

## Sources

- <https://huggingface.co/Comfy-Org/MOSS-Image>
- <https://huggingface.co/toxicdog/MOSS-Image-SFT-Turbo-INT8-ConvRot>
