# MOSS-Image — model notes

> **What this is.** The MOSS-Image *what*. `docs/playbooks/add-model/` is the generic *how*.
>
> Wiring card: MPI-1243. Bench, numbers and verdict: MPI-1180 `validation.md` (raw research in
> `tasks/MPI-1180/research/`, VAE A/B in `tasks/MPI-1243/research/`).

OpenMOSS, 5B, text-to-image only (upstream has no edit and no image-to-image). Its strength is exact
lettering and long prompts: every text line in the bench came out spelled as written. One card
(`moss-image`) with a Turbo button, t2i only.

| | |
|---|---|
| Licence | Apache-2.0 (OpenMOSS weights, Comfy-Org repack, toxicdog Turbo). No licence gate |
| Engine floor | ComfyUI core with PR 17095 + 17099 (native MOSS), shipped in 0.42.1 |
| Transformers | BOTH install. Turbo on = `moss-image-turbo-transformer` (toxicdog SFT-Turbo int8_convrot, a COMMUNITY merge, "experimental"; 8 steps, cfg 1, no negative). Turbo off = `moss-image-sft-transformer` (official SFT int8_convrot, 25 steps, cfg 2.5). Base is not shipped |
| Text encoder | `moss-image-qwen35-9b-clip` (Qwen3.5-9B w4a8 GPTQ, 6.84 GB) at CLIPLoader type `moss_image`. Not the Qwen3-VL 4B FLUX.3 uses |
| VAE | `vae-flux2` (shared). The bench's `flux2-vae_small` decodes the same picture (43 dB PSNR, 2026-10-22) |
| Graph | A copy of FLUX.3's raw with the t2i loaders and settings swapped: `raw/moss_t2i_template.json` -> `generate_moss.py` -> `comfy_workflows/moss_t2i.json`. FLUX.3's other op branches stay in the graph (unreachable on t2i but validated, hence FLUX.3's node packs and upscaler in the deps). No shift node: core sets MOSS shift 5.0 |
| Settings | Shared KSampler `er_sde`/`simple` for both weights. Turbo on euler was the same quality, ~1 s faster per image; not switched (it needs a graph change) |
| Boxes | `layoutBoxes: { ops: ['t2i'], format: 'moss' }`. The app replaces the prompt with what core `MOSSImageLayoutPrompt` builds (`mossLayoutPrompt`, `js/data/layoutBoxes.js`): `summary.caption` = the prompt, one `object` item per box, pixel `yxyx` edges centred on the frame. A `<name>` in the prompt reads as the name in words. No box node in the graph. Text and character labels are not offered yet |
| Speed (bench, 1024x1024, 16 GB card) | Turbo ~6 s sampler, ~11 s per image; SFT ~27 s sampler, ~31 s per image. Peak VRAM ~7-8 GB with the encoder cached, ~12.2 GB cold |

## Hard rules

- **Never default a negative of `nsfw, ...`** (the official templates' default). SFT ships with an
  empty negative: the bench showed no difference with it.
- **Turbo is not official.** Say "community Turbo" wherever the source matters.

## Sources

- <https://huggingface.co/Comfy-Org/MOSS-Image>
- <https://huggingface.co/toxicdog/MOSS-Image-SFT-Turbo-INT8-ConvRot>
