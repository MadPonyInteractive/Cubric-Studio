# MPI-1181 brief - FLUX.3 Klein

Umbrella: MPI-1179 (New Models to Test), phase 2. Researched 2026-10-18 from Fabio's video
(<https://www.youtube.com/watch?v=gfLy2yjJ0sI>, The AI Blueprint, 2026-10-16) and the sources below.

**Dev-gated (`devOnly: true`). Not a 2.1 item** (Fabio, 2026-10-18).

## What it is

- Black Forest Labs FLUX.3 [klein], released 2026-10-15: 5.6B open weights, first of the FLUX 3
  family. <https://bfl.ai/blog/flux-3-image-klein>
- Text-to-image, single-reference edit and multi-reference (up to 10 images) in ONE model.
  Extra: bounding boxes in the prompt (0-1000 grid) to place, recolour, move or remove things.
- Two checkpoints:

| Checkpoint | File stem | Steps | CFG | Use |
|---|---|---|---|---|
| Base | `flux3-image-klein-base-*` | 50 | 3.5 | best quality (video: clearly more natural skin) |
| Distilled | `flux3-image-klein-*` | 16 | 1 (none) | fast; video calls it slightly plastic |

  Video settings: euler + simple, 2 MP (4 MP for ~2048 px). Edit took ~35 s at 50 steps on base.

## Files (gated `auto`: accept on HF, <https://huggingface.co/black-forest-labs/flux-3-image-klein-comfy>)

| Folder | File | Size |
|---|---|---|
| diffusion_models | base / distilled `-bf16` | 11.1 GB each |
| diffusion_models | base / distilled `-int8-convrot` | 5.8 GB each |
| diffusion_models | base / distilled `-nvfp4` | 5.3 GB each (Blackwell only) |
| text_encoders | `qwen3vl_4b_bf16` / `_int8_convrot` | 8.9 / 4.9 GB |
| text_encoders | `qwen3.5_9b_flux3_prompt_upsampler_{bf16,int8_convrot,w4a8}` | 18.8 / 9.8 / 6.7 GB |
| vae | `flux2-vae` | 0.34 GB, already a dep (`assetDeps.js`) |

The repo also ships 12 official workflows (`flux3_klein{,_base}_{bf16,int8}_{t2i,i2i,mi2i}.json`).

## Shape for Cubric - ONE card with a Turbo button (Fabio, 2026-10-18)

Every checkpoint ships in all three formats (bf16, int8-convrot, nvfp4), so the format and the
base/distilled choice are separate axes. Both int8 files are 5.8 GB, so Fabio's call is **one
model card carrying both, with a Turbo button that picks between them** (it replaces the
two-card Balanced/High split briefly on this card earlier today):

- **Turbo ON** = distilled `flux3-image-klein-int8-convrot`: 16 steps, fast.
- **Turbo OFF** = base `flux3-image-klein-base-int8-convrot`: 50 steps, best quality.
- No bf16 (11.1 GB, double the download for the same model) and no nvfp4 (pays off on RTX 50xx only).

**The text encoders are the SAME for both** (checked 2026-10-18 in ComfyUI's four official
templates, `Comfy-Org/workflow_templates` `templates/image_flux3_klein{,_distilled}_{t2i,image_edit}.json`).
Every one loads `qwen3vl_4b_int8_convrot` (CLIP type `flux3`), the
`qwen3.5_9b_flux3_prompt_upsampler_w4a8` upsampler into a `Flux3LayoutPrompt` node, and
`flux2-vae`. **Only the `UNETLoader` file and the KSampler steps differ**, so Turbo is a
diffusion-model switch inside one graph. Template KSampler values: edit base 50 steps / euler,
edit distilled 16 / euler, both t2i 15 / er_sde, CFG 1 everywhere. That disagrees with the model
card's base CFG 3.5: settle it at bench time.

How Turbo is built today: `capabilities.turboToggle` on Krea 2 renders the `krea2Turbo` control,
which injects `Input_is_Turbo`. The graph reads `Get_turbo` for its own steps/CFG
(`js/data/modelConstants/models.js`, `js/data/generationControls.js`). Krea 2 swaps an accelerator
LoRA on one weight. Here the switch picks one of two UNETLoaders, so prove that only the chosen
weight loads (a lazy switch, e.g. MpiAnySwitch by name). Both weights are required deps:
**11.6 GB of diffusion weights** plus the shared encoder, against 5.8 GB for one tier.

**Fabio's read of the video: the distilled model is poor for realism next to the base.** Same
prompt and seed: plastic, oily-looking skin, and the whole picture looks less natural. Base is
the mode for photoreal work. The distilled model held up on product shots and text (coffee ad,
perfume bottle). Test that gap on photoreal prompts and say it on the Turbo control's hint.
Once, also compare base int8 against base bf16 to confirm int8 keeps base's quality edge.

- **Text encoder reuse:** we already ship `qwen3vl-abliterated-clip` (Qwen3-VL-4B abliterated
  fp8_scaled) as an engine asset. Test whether FLUX.3 accepts it before adding the 4.9 GB
  `qwen3vl_4b_int8_convrot` dep. Krea2 made the same swap.
- **Prompt upsampler:** BFL say do not run Klein without it, and every official template wires it.
  The 6.7-18.8 GB Qwen3.5-9B is a RAM risk for the 16 GB tester. Bench whether our own Enhancer /
  Cosmo recipe does the same job (BFL publish `system_prompts.json`) before shipping it.
- **Graph:** start as a COPY of `comfy_workflows/raw/klein_t2i_template.json` (add-model playbook
  01 §0a), loaders swapped in ComfyUI. The official workflows are reference only.

## Blocker - the engine

- Native support is Comfy-Org/ComfyUI PR 17064 (merged 2026-10-15), first in **v0.41.0**.
- The shipped engine pins v0.39.0 (`dev_configs/node_lock.json`). The G:\ComfyUi bench is also
  on 0.39.0.
- MOSS-Image (MPI-1180) needs v0.42.0. **One bump to >= v0.42.0 covers both.** MPI-1044's Pod
  smoke item now says to check for it first.

## Licence - FLUX Kommunity License (read 2026-10-18)

- Distribution and use only for Non-Commercial Purposes.
- "Qualifying Users" (under US$5M gross annual revenue) may use **Outputs** commercially.
- §2(e): content filtering or review of Outputs required (our child-safety gate is the
  candidate).
- §4(g): no use by sanctioned parties, and no IP proxying to hide location.
- Gate it like FLUX.2 Klein 9B (`js/data/modelConstants/licences.js`, MPI-357): licence copy +
  acceptance receipt. A NEW licence entry, never Klein 9B's text.

## Done when

A verdict in `validation.md`: wire it (open an `/mpi-add-model` card, still `devOnly`) or drop it.
It needs measured speed, VRAM and RAM for Turbo on and off, base vs distilled quality, and the TE-reuse and
upsampler answers.
