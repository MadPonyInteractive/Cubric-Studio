# MPI-1198 brief - Qwen-Image 2.1 Turbo

Umbrella: MPI-1179 (New Models to Test). Fabio found it 2026-10-19 ("didn't know that was a thing").
Researched 2026-10-19 from the Hugging Face API.

## What it is

- Official accelerated checkpoint of Qwen-Image 2.1 (the model we already ship, gated non-commercial,
  MPI-936 / umbrella MPI-1064): `Qwen/Qwen-Image-2.1-Turbo`, published 2026-10-09. Same 7B model,
  **8 steps** instead of ~40. Third-party write-ups say it keeps t2i, multi-image edit and the
  transparent (RGBA) output - confirm each on the bench, do not trust the blogs.
- Licence: same family licence as 2.1 (HF tag `other`; write-ups call it the Qwen Research License,
  non-commercial). **Read the Turbo repo's own LICENSE before wiring** - if it matches 2.1's, the
  existing licence entry and receipt cover it; if not, it needs its own entry.

## Files (Comfy-Org/Qwen-Image-2.1, not gated)

| Folder | File | Size |
|---|---|---|
| loras | `qwen_image_2.1_turbo_lora_avg_rank_178_bf16` | 0.91 GB |
| diffusion_models | `qwen_image_2.1_turbo_int8_convrot` | 7.26 GB |
| diffusion_models | `qwen_image_2.1_turbo_bf16` | 14.23 GB (skip) |

Already on disk: base `qwen_image_2.1_int8_convrot` (G:\CubricModels), its text encoder and VAE.

## Shape for Cubric - a Turbo button on the EXISTING Qwen 2.1 card

Two ways, bench both, ship one:

1. **LoRA (preferred if quality holds):** the 0.91 GB turbo LoRA on the base weight users already
   have. Same pattern as Krea 2's Turbo (`capabilities.turboToggle`, the graph reads `Get_turbo`
   for steps/CFG, LoRA strength 0 when off). Tiny download, no second 7 GB weight on disk.
2. **Own weight:** the 7.26 GB int8 Turbo through an `MpiIfElse` loader switch, the FLUX.3 Klein
   pattern (MPI-1181). Only if the LoRA visibly loses to it.

Compare at the same seed/prompt: base 40 steps vs LoRA 8 vs int8 Turbo 8. Photoreal, text,
an edit, and an RGBA output. Measure time and peak VRAM on Fabio's card.

## Bench downloads (G: is full - C:\AI, which the bench already maps via extra_model_paths.yaml)

- `C:\AI\loras\qwen-image-2.1\qwen_image_2.1_turbo_lora_avg_rank_178_bf16.safetensors` (0.91 GB) first.
- The 7.26 GB int8 only if the LoRA disappoints.

## Release

**NOT 2.1.1** (Fabio, 2026-10-19: "leave Qwen 2.1 Turbo for another release"). Pick up after
2.1.1 ships. Its Pod smoke then adds only the Qwen 2.1 ops (LoRA route: same weight, new dep + graph change).

## Done when

A verdict in `validation.md`: LoRA, own weight, or drop - with the side-by-side and the numbers.
