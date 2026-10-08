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

**Encoder licence:** `Qwen/Qwen-Image-2.1/text_encoder` is a `Qwen3VLForConditionalGeneration`
(8B shape) but its shards are re-cut (sizes and LFS oids differ from `Qwen/Qwen3-VL-8B-Instruct`),
so it cannot be proven to be the Apache-2.0 stock model. Treat it as research-licensed and fetch
from HF like the rest. The PE encoders are skipped (we have our own enhancer; +9.5 GB each).

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
