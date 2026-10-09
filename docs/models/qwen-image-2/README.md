# Qwen-Image 2.1 — model notes

> **What this is.** The Qwen-Image 2.1 *what*. `docs/playbooks/add-model/` is the generic *how*.
>
> Tracking card: MPI-936. Raw research: `.agents/mpi-kanban/tasks/MPI-936/research/`
> (`weights.md` = weights, licences, accelerators; `graph.md` = the official graph).

Qwen-Image 2.1 (Alibaba, released 2026-09-20): one 7B model for text-to-image AND instruction
editing (up to 10 reference images in the official template; we ship 8), shipped with Klein 9B's
seven ops (Fabio 2026-10-08), with native transparent (RGBA)
output through a 4-channel VAE. **Not** Qwen-Image-Edit 2511 ([../qwen-edit/](../qwen-edit/)) —
different transformer, encoder and VAE; nothing is shared between the two.

| | |
|---|---|
| Licence | **Qwen RESEARCH License — "research or evaluation only, no commercial use".** No Outputs clause: the IMAGES are not commercially usable either (unlike Klein 9B). Never say "personal use". Ships behind a `MODEL_LICENCES` gate + NC badge; bundle the agreement under `licences/<id>/`; attribution notice in `poweredBy`. Full facts: the card's `brief.md` |
| Engine floor | ComfyUI core **0.37.0** (support), shipped on **0.39.0** (MPI-1043: int8/int4 KV-cache crash fix, RGBA preprocessing fix) |
| Nodes | **All core** — `UNETLoader` → `QwenImage21Cache` → `KSampler`; `CLIPLoader` (`type: qwen_image`) → `TextEncodeQwenImage21` (`image_1..image_16`); `VAELoader` → `VAEDecode`. The official template gathers edit refs with `BatchImagesNode`; ours wires `images.image_1..8` straight in. The model needs no custom pack; the op branches use Klein's (MpiNodes, kjnodes, UltimateSDUpscale, controlnet_aux, inpaint-cropandstitch, LanPaint), plus Impact Pack for Tile Upscale |
| Settings | euler / simple, **30 steps** on t2i/edit, i2i and control; LanPaint inpaint **20** (Fabio: inpaint runs short like Krea2's 12-of-25, tune on results); detail and upscale **15** (half). Was 25/12 until 2026-10-09: on fixed seeds 25 is where limbs break and 30 lands on nearly 40's picture for +20% time (MPI-936 validation.md). **cfg 1** (the negative does nothing at cfg 1; ~2 follows dense prompts but over-sharpens). ~1 MP default |
| Transformer | `diffusion_models/qwen_image_2.1_int8_convrot.safetensors` 7.26 GB — **HF only** (`Comfy-Org/Qwen-Image-2.1`), never R2: research-licensed |
| Text encoder | **`qwen3vl-8b-int8-clip`** (`text_encoders/qwen3vl_8b_int8_convrot.safetensors`, 8.71 GB, Comfy-Org's int8 cut, the 2.1 templates' default), shared with both Boogu tiers. 2.1's encoder is stock Qwen3-VL-8B-Instruct (Apache-2.0), proven tensor-for-tensor — see `weights.md` § Phase 0.6. Was the fp8_scaled `boogu-qwen3vl-8b-clip` until 2026-10-09 (Fabio: int8 wherever it fits); that dep stays, deprecated, for the orphan sweep |
| VAE | `vae/qwen_image_2.1_vae_bf16.safetensors` 0.68 GB — new (alpha VAE; NOT `vae-qwen-image`), **HF only** |
| Graph | **ONE file, Klein's shape** (`comfy_workflows/qwen_image_2_1.json`, raw source `raw/qwen_image_2_1.json`, bench source `research/bench/graph.py`): `Input_wf_type` 1 t2i, 2 i2i, 3 control, 4 edit, 5 inpaint, 6 detail, 7 upscale. Masked edit + inpaint = mask crop -> **LanPaint** -> stitch (Klein's route; LanPaint runs on 2.1 because it is `ModelType.FLUX`); detail = our crop/stitch at `Input_denoise` (not Impact's MaskDetailer); upscale = UltimateSDUpscale, or the Tile Upscale group (MPI-1038, Impact Pack). User LoRA rack, then the style rack (below). Bench proof per op: `research/bench-results.md` run 3 |
| ControlNet | `model_patches/qwen_image_2.1_fun_controlnet_union_int8_convrot.safetensors` 3.78 GB, **HF only** (same research licence), core `ModelPatchLoader` -> `QwenImageDiffsynthControlnet`. One patch, eight conditions + an inpaint mode; we wire depth / pose / scribble / canny at `CONTROL_TYPES`' indices via `AIO_Preprocessor`, as SDXL's union |
| Alpha | The VAE decodes RGBA on EVERY run. t2i and edit keep it; every branch that repaints an opaque source (i2i, inpaint, detail, upscale) AND control drop it with `SplitImageWithAlpha` (control came back with a see-through ghost on 4.7% of the subject) |
| Styles | **Eight, on all seven ops** (MPI-936, Fabio's picks 2026-10-09): Danrisi Lenovo / Canon / Samsung / Film Stills / Grainscape (photo looks made for 0.7, hence `controlDefaults.stylization: 0.7`), Detail Fix (e-n-v-y: a look, not a detail booster; **no licence stated upstream**; its `triggers` line is EMPTY on purpose), Natural Exposure and Clay (prithivMLmods image-to-image adapters: their triggers are instructions, so edit + empty prompt + style = a photo filter). `Input_Lora_6` -> `MpiStyleSelector` -> 2 banks -> `QwenImage21Cache`; the trigger is appended to the prompt (`StringConcatenate`, space) feeding BOTH encoders. All HF-primary (`loraDeps.js`). Clay ships the last of its three checkpoints (3000 steps), not benched against 1000/2000. Guard: `tests/style-rack-shape.test.cjs` |
| Speed tier | Standard only for now. Alibaba's Fun-Acc 4-step LoRA needs a parallel-decoding head core ComfyUI runs for H3 only; Viggle turbo 6-step is the candidate fast tier (needs a resolution-dependent sigma node) — `weights.md` § Phase 0.4 |
| Skipped | Qwen3.5-9B prompt-enhancer encoders (+9.5 GB each; we have our own enhancer), the background-removal template (BiRefNet / SAM3 cover it) |
| Prompting | Own recipe `qwen-image-2.1` (MPI-1048), built from those enhancers' published system prompts, which are NOT part of the encoder; guide `docs/agent/models/qwen-image-2.1.md` (Cosmo, MCP), evidence `docs/recipes/research/qwen-image-2.1/` |

## Hard rules

- **Never copy Klein 9B's "images stay commercially usable" line** into this model's gate,
  description or agent note — the research licence has no Outputs clause.
- **Weights never go to R2 except the encoder** (the only Apache-2.0 file). We do not
  redistribute research-licensed weights; users fetch them from Hugging Face.
- **Transparency is asked for in the PROMPT** ("transparent background, alpha channel"); there is
  no switch. The capture node must keep the alpha channel.
- **Anything blending the decode with an RGB image needs `SplitImageWithAlpha` first** — the
  stitch failed `size of tensor a (4) must match b (3)` until it had one.
- **Wire every `MpiAnySwitch10` slot.** It picks the Nth CONNECTED input, not `any_N`: with
  control unwired, wf 5 ran detail and wf 7 ran off the end with no output.

## Sources

- Weights: `huggingface.co/Comfy-Org/Qwen-Image-2.1`, `huggingface.co/Qwen/Qwen-Image-2.1`
- Official graphs: ComfyUI `comfyui_workflow_templates_json` 0.39 —
  `image_qwen_image_2_1_t2i.json`, `image_qwen_image_2_1_image_edit.json`
- Accelerators: `alibaba-pai/Qwen-Image-2.1-Fun-Acc-LoRAs`, `Viggle/Qwen-Image-2.1-viggle-turbo`
