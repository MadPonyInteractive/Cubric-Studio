# Qwen-Image 2.1 - weights and LoRA survey (2026-10-08)

Every repo below tags `license: other / qwen-research`. Nothing is re-hosted on R2: a user
fetches each file straight from its HF repo (brief, "Weights source").

## Comfy-Org/Qwen-Image-2.1 (the repack the official templates load)

| file | GB | role |
|---|---|---|
| `diffusion_models/qwen_image_2.1_bf16.safetensors` | 14.23 | transformer, full |
| `diffusion_models/qwen_image_2.1_int8_convrot.safetensors` | 7.26 | transformer, templates' default |
| `text_encoders/qwen3vl_8b_bf16.safetensors` | 17.53 | encoder, full |
| `text_encoders/qwen3vl_8b_int8_convrot.safetensors` | 9.35 | encoder, templates' default |
| `text_encoders/qwen3vl_8b_w4a8.safetensors` | 6.31 | encoder, smallest |
| `text_encoders/qwen3.5_9b_qwen_image_2.1_pe_t2i.int8_convrot.safetensors` | 9.47 | optional prompt enhancer (t2i), off by default |
| `text_encoders/qwen3.5_9b_qwen_image_2.1_pe_i2i.int8_convrot.safetensors` | 9.47 | optional prompt enhancer (edit), off by default |
| `vae/qwen_image_2.1_vae_bf16.safetensors` | 0.68 | 4-channel VAE (alpha) |
| `model_patches/qwen_image_2.1_fun_controlnet_union_{bf16,int8_convrot}` | 7.55 / 3.78 | ControlNet union, out of scope |

**Encoder licence - SUPERSEDED 2026-10-08 (session 9435f38c), see "Phase 0.6" below.** The shards
are re-cut, but the TENSORS are stock Qwen3-VL-8B-Instruct (Apache-2.0). The PE encoders are
skipped (we have our own enhancer; +9.5 GB each).

## Other quants

- `unsloth/Qwen-Image-2.1-GGUF`: Q2_K 2.47 ... Q4_K_M 4.20 ... Q8_0 7.64 GB.
- `unsloth/Qwen-Image-2.1-FP8`: FP8 7.12, INT8 7.26, encoder FP8 9.39 / INT8-ConvRot 9.35 GB.

## Accelerators (distilled tiers)

- `alibaba-pai/Qwen-Image-2.1-Fun-Acc-LoRAs`: `Qwen-Image-2.1-Fun-Acc-4Step.safetensors`, 0.35 GB. Alibaba's own.
- `Viggle/Qwen-Image-2.1-viggle-turbo`: 6-step v0.3 LoRA r128 0.68 GB / r256 1.36 GB, plus merged
  6-step transformers (int8_convrot 7.26, fp8 7.25, GGUF Q4_K_M 4.34 ... Q8_0 7.69 GB).

Strength axes (model-only vs model+clip) and step/cfg per accelerator: not yet read off the model
cards - do it at graph authoring.

## Sizing note

Template default set = int8 transformer 7.26 + int8 encoder 9.35 + VAE 0.68 = **17.3 GB**
(matches the competitor pack's ~17 GB). w4a8 encoder brings it to 14.2 GB.

## Phase 0.6 dep-reuse pass (2026-10-08, session 9435f38c)

Method: HTTP range reads of safetensors headers + tensor bytes (no download). Scripts were
scratch; the method is "same key set, then sha256 of the first 4 MB of sampled tensors".

- **Encoder = stock Qwen3-VL-8B-Instruct.** `Qwen/Qwen-Image-2.1/text_encoder` vs
  `Qwen/Qwen3-VL-8B-Instruct`: 750/750 keys common, 14/14 sampled tensors byte-identical
  (`lm_head`, `embed_tokens`, LM layers 0/17/20/35, final norm, vision block 0, merger).
  So the encoder is **Apache-2.0**, not research-licensed.
- **Our hosted Boogu encoder is the same base.** `boogu-qwen3vl-8b-clip`
  (`text_encoders/qwen3vl_8b_fp8_scaled.safetensors`, R2, 9.86 GB): its unquantised bf16
  norms (LM layer 0 input norm, layer 17 post-attn norm, final norm, vision block 0 norm1) equal
  stock exactly (maxdiff 0). Comfy-Org 2.1 `int8_convrot` and `w4a8` encoders: same result.
  ComfyUI single-file keys drop `language_model.` (`model.layers.N...`).
  **Decision: REUSE `boogu-qwen3vl-8b-clip`** at CLIPLoader `type: qwen_image`. Saves a 9.35 GB
  download (zero for anyone with Boogu). fp8_scaled vs the template's int8_convrot quality: judge
  at authoring; only pull the int8 encoder if fp8 output looks off.
- **VAE: NEW.** `vae/qwen_image_2.1_vae_bf16.safetensors` (675,509,688 B, sha256 `bb21f747...`)
  is the 2.1 alpha VAE; `vae-qwen-image` (Qwen-Image 1 / Krea2) is a different file. Research
  licence, so HF only.
- **Transformer: NEW.** `qwen_image_2.1_int8_convrot.safetensors` 7,256,783,064 B, sha256
  `cb74113c...`. Research licence, so HF only.

## Phase 0.4 accelerator strength axes (2026-10-08)

- **alibaba-pai Fun-Acc 4-step: NOT runnable on core ComfyUI 0.39.** It is Parallel Decoding
  Distillation: the file carries `proj_out.weight [4, 64, 4096]` (a per-step head bank) and 64
  full norm weights besides the LoRA pairs, plus `pdd_config.json` and a custom diffusers
  scheduler (`qwenimage21_pdd.py`). Core 0.39 implements PDD heads only in
  `comfy/ldm/minimax/model.py` (H3). Dropped; the earlier "fast = int8 + Fun-Acc" pick is void.
- **Viggle turbo v0.3 6-step: plain PEFT LoRA** (`lora_A`/`lora_B` only, transformer-only, so a
  model-only loader). r128 0.68 GB / r256 1.36 GB, or merged transformers (int8_convrot 7.26 GB,
  fp8, GGUF). Its ComfyUI graph needs two nodes from Viggle's `comfyui/viggle_turbo.py` (not a
  registry pack): `ViggleTurboSigmas` (resolution-dependent: mu = 0.5 + 0.4*(tokens-256)/7936,
  tokens = (H/16)*(W/16); raw nodes `1.0, 0.9375, 0.875, 0.75, 0.5, 0.25`) and `ViggleTurboLora`
  (runtime side-branch; their note: `LoraLoaderModelOnly` on int8 weights adds requant noise ~4x
  the LoRA update). Merged int8 transformer + `SamplerCustomAdvanced` avoids the LoRA node;
  the sigmas still need an MpiNode (core `ManualSigmas` is fixed-resolution). Fast tier deferred
  until the standard tier ships.
- Licences: all three repos tag `license: other` (qwen-research), none HF-gated.
