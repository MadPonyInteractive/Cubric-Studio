# MPI-1180 brief - bench MOSS-Image

Umbrella: MPI-1179 (New Models to Test), phase 1. Researched 2026-10-18.

## What it is

- OpenMOSS MOSS-Image, released 2026-10-16: <https://github.com/OpenMOSS/MOSS-Image>.
- 5B single-stream DiT in the FLUX.2 latent space. Text encoder is a stock Qwen3.5-9B;
  decoder is `flux2-vae`, which we already ship (`js/data/modelConstants/assetDeps.js`).
- Two checkpoints: Base and SFT (SFT is the curated fine-tune).
- **Text-to-image only.** No edit, no img2img. Its extra is layout-to-image: a JSON prompt
  with bounding boxes placing text and objects. Strong text rendering, prompts up to 4K tokens.
- Licence: weights and code Apache-2.0 (HF model card + the ComfyUI PR).

## Unblocked 2026-10-19

- 2.1 shipped engine **v0.42.1** (2.1.0 and 2.1.1 published). Both MOSS PRs are inside it:
  `compare v0.42.1...<merge sha>` reads `behind` for PR 17095 (e087d8f6) and PR 17099 (a639f187).
  The bench no longer waits on a bump; the blocker section below is history.

## Bounding boxes: reuse the Flux 3 work (Fabio, 2026-10-19)

- Fabio is integrating FLUX.3 Klein (MPI-1181), which uses bounding boxes for both text-to-image
  and editing, and that card is building the app's way of drawing and sending those boxes.
- MOSS-Image takes boxes too (its layout prompt, "What to measure" item 4). Do NOT build a second
  box UI or prompt path for MOSS: reuse whatever MPI-1181 lands, and read its brief's box section
  (`t2i_bbox` / `i2i_bbox`, the 0-1000 grid, `CreateBoundingBoxes` -> layout prompt) before
  wiring MOSS. Check whether MOSS's layout JSON matches Flux 3's row shape or needs a mapping.

## Blocker - the engine

- Native ComfyUI support: Comfy-Org/ComfyUI PR 17095 (kijai), merged 2026-10-16, plus
  PR 17099 (fused qkv) on 2026-10-17. Both land AFTER the v0.41.0 tag (2026-10-15), so no
  release carries them yet. Expect v0.42.0.
- Our shipped engine pins v0.39.0 (`dev_configs/node_lock.json`). The bench runs after the
  engine bump to >= v0.42.0 (`/mpi-bump-engine`), not on a master build.
- A comfy-kitchen kernel PR (Comfy-Org/comfy-kitchen PR 251) promises ~30% faster int8
  inference; check whether it shipped by bench time.

## Files (Comfy-Org repack, <https://huggingface.co/Comfy-Org/MOSS-Image>)

| Folder | File | Size |
|---|---|---|
| diffusion_models | moss_image_sft_int8_convrot | 5.4 GB |
| diffusion_models | moss_image_sft_bf16 | 10.2 GB |
| diffusion_models | moss_image_base_int8_convrot / _bf16 | 5.4 / 10.2 GB |
| text_encoders | qwen3.5_9b_w4a8_gptq | 7.3 GB |
| text_encoders | qwen3.5_9b_int8_convrot | 9.7 GB |
| vae | flux2-vae (already a dep) | 0.34 GB |

The OpenMOSS ComfyUI Manager plugin loads a diffusers folder instead; ignore it, use core.

## What to measure

1. Speed per image at the defaults (50 steps, CFG 3, shift 5, 1-2 MP) on a 3060-class and
   a 4090/5090-class card, local and on a Pod. No CUDA speed report existed on 2026-10-18;
   it is undistilled with two forwards per step, so expect it slower than Klein.
2. Peak VRAM and system RAM. The 7.3-9.7 GB text encoder is the risk for the 16 GB RAM
   photographer tester.
3. Quality against what we ship for text-to-image: text rendering and long prompts above all.
4. Layout prompts: core ships a "MOSS-Image Layout Prompt" node fed by Create Bounding Boxes.
   Does it earn a UI, or is it agent-only?
5. Base vs SFT: which one (if either) would ship.

## Engine pin for the bump (MPI-1193, 2026-10-19)

Bump to the first tag AFTER v0.42.0, not v0.42.0 itself. v0.42.0 still has the Stop crash
(a mid-sampling Stop on Qwen-Image 2.1 / LTX 2.3 / MiniMax H3 aborts ComfyUI with "CUDA error:
an illegal memory access", Comfy-Org/ComfyUI#17115). The fix, PR #17178 (7db08fe50), merged
one commit after the v0.42.0 tag. A commit pin does not work: fresh installs download the
tag's portable, and the in-place upgrade needs host git on Windows. 2.1 ships on 0.41.0 with
the crash (Fabio, 2026-10-19); the restart is automatic. When the release carrying the fix is
out, close the public known-issue https://github.com/MadPonyInteractive/Cubric-Studio/issues/10.

## Done when

A verdict in `validation.md`: wire it (open an `/mpi-add-model` card) or drop it, with the
measured numbers.
