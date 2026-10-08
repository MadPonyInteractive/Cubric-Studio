# Qwen-Image 2.1 - the official ComfyUI graph (2026-10-08)

Source: `Comfy-Org/workflow_templates` `image_qwen_image_2_1_t2i.json` and
`image_qwen_image_2_1_image_edit.json`; docs.comfy.org `tutorials/image/qwen/qwen-image-2-1`.

## Engine floor

Core support landed in v0.37.0 (PR #16400). v0.38.0 adds KV-cache placement, RGBA preprocessing
fix, fp16 activation clamp; v0.39.0 fixes an int8/int4 KV-cache crash (PR #16667). Target v0.39.0
(MPI-1043).

## Nodes - all CORE, no custom pack

`UNETLoader` -> `QwenImage21Cache` (device auto, dtype default) -> `KSampler`;
`CLIPLoader` (type `qwen_image`) -> `TextEncodeQwenImage21` (prompt, negative, max_length 1024,
`image_1..image_16`; edit template wires 10) -> `KSampler`;
`VAELoader` -> `VAEDecode`; `EmptyLatentImage` (or the edit subgraph's canvas from `image_1`).
Edit refs are gathered by `BatchImagesNode`. Optional prompt enhancement = `TextGenerate` on a
Qwen3.5-9B PE encoder behind a `ComfySwitchNode`, off by default (skip it).

## Settings

euler / simple, 25 steps (published pipeline uses 40-50; local edits work at 4-8), cfg 1
(negative has no effect at 1; ~2 follows dense prompts but over-sharpens). ~1 MP default; edit
`resolution` 0 = keep each reference's own size.

## RGBA

4-channel VAE. Transparency is asked for in the PROMPT ("transparent background, alpha
channel"). The template saves with `SaveImageAdvanced`; our capture node must keep the alpha -
check at authoring.
