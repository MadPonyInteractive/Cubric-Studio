# MPI-1276 — Fibo 2.0 research (desk research, 2026-10-24)

Nothing benched yet. Everything below comes from the model cards, the ComfyUI PR and press. It is not measured.

## What it is
- Bria AI, 8B flow-matching single-stream DiT (44 blocks), FLUX.2 VAE latent space, Qwen3-VL-4B-Instruct
  encoder + 2-layer Perceiver resampler (256-512 "gist" tokens). Trained on licensed data only (~1B-image set).
- **Dev** (`briaai/Fibo-2.0-dev`): t2i + instruction / masked / multi-reference edit, one set of weights.
  50 steps cfg 5 (diffusers card); the ComfyUI PR uses 30 steps cfg 5, euler/simple. ~1 MP, sizes /16.
- **Edit Turbo** (`briaai/Fibo-2.0-edit-turbo`): distilled from Dev, edit-only, 4 steps cfg 1, the
  negative prompt is ignored. Up to 4 references cited as `<image_1>`..`<image_4>`.
- Bria has announced follow-up LoRAs (multi-turn edit, background removal, product shot, "boring reality",
  mask eraser, expansion). None has shipped.

## Claims (vendor-cited, no independent check found)
- Artificial Analysis snapshot from 2026-10-20: #1 open-weights on Image Editing (Elo 1087), #2 on T2I, and a
  statistical tie with Qwen-Image 2.1 on AA-T2I v2.1.
- By edit category: strongest at enhancement/restoration (#6 overall). Weakest at composition-heavy and
  multi-step-reasoning edits. Text rendering/layout lags on T2I.

## Licence: CC BY-NC 4.0, HF-gated (form + login)
- Non-commercial only. Commercial use needs a separate deal with Bria. No territory clause.
- No Outputs clause either way (CC licences don't address model outputs). Read it as NC for the
  user's images too, the same posture as Qwen-Image 2.1 / PiD.
- So it would ship behind the non-commercial licence gate (MPI-451 pattern). **Open question:**
  can we re-host on R2 (CC BY-NC permits NC redistribution with attribution, but the HF gate adds Bria's
  access terms)? The other option is pointing at the gated HF repo with the user's own token.

## ComfyUI
- Native in core: PR comfyanonymous/ComfyUI#17240 (kijai), merged 2026-10-21, plus #17285 (T2I negative fix).
  **Not in v0.42.1**, our pinned `comfyui.core.tag` (released 2026-10-19). The next release tag or an
  engine bump (`/mpi-bump-engine`) is required first.
- Node `TextEncodeFibo2` (clip, prompt, negative_prompt, optional vae, images image_1..16, width, height,
  batch_size) -> positive/negative/latent with reference latents. CLIPLoader type `fibo2`. No mask input
  on this node.
- **Plain text is accepted.** The node takes "a structured JSON caption or plain text". With images, the
  prompt is the edit instruction, or a JSON caption of the result with an `edit_instruction` key.
- Known issue: int8 error on the edit path from the Qwen-VL int8 vision tower (ComfyUI #17248).
- Comfy-Org repack (`Comfy-Org/Fibo-2.0`): bf16 + int8_convrot for both transformers and for the encoder.
  bf16 transformer ~16.25 GB, encoder ~8.9 GB, VAE 0.34 GB. int8 is roughly half (sizes not listed).

## Prompt format: VGL JSON
- Trained on long structured JSON captions (Bria's "VGL": objects, background, lighting, aesthetics, camera,
  text, `short_description`, `edit_instruction`). Bria's `bria-vgl` (MIT, github.com/Bria-AI/vgl) writes
  them with **Gemini** (`GEMINI_API_KEY`), or Claude on Bedrock. It takes any litellm id, "tuned for Gemini".
- We ship no Gemini key (DeepInfra only), so bria-vgl as-is is out. Options: (a) plain text,
  (b) VGL JSON written by our own enhancer (local Qwen3-VL or Cosmo via DeepInfra) using the
  prompt/schema in bria-vgl's open source. **The bench must answer how much (b) beats (a).**

## Fit with what we ship
- Reuse: `vae/flux2-vae.safetensors` (shared). A Qwen3-VL-4B encoder already ships
  (`qwen3vl_4b_abliterated_fp8_scaled`, FLUX.3). Whether `fibo2` accepts the abliterated fp8 is a
  bench question. FLUX.3 saw identical pictures with BFL's stock encoder. If it works, only the
  transformer is new.
- Rivals already shipped for edit: Qwen-Image 2.1 (NC, the model it ties), FLUX.3 Klein, Qwen-Edit-2511
  (Apache), Klein 4B/9B. Edit Turbo at 4 steps is the interesting one for the RTX 3060 / 16 GB tester.

## Bench plan (proposal)
1. Engine on a build containing #17240 (dev bench, not the shipped pin).
2. Edit Turbo int8 vs bf16, abliterated-fp8 vs stock encoder: same pictures?
3. Same edit set (removal, swap, style, restoration, 2-4 reference composite) vs Qwen-Image 2.1, FLUX.3
   Klein and Qwen-Edit-2511: quality, identity keep, seconds, peak VRAM.
4. Plain-text vs enhancer-written VGL JSON on the same edits.
5. Dev t2i only if Edit Turbo earns a place.

## Sources
- https://huggingface.co/Comfy-Org/Fibo-2.0
- https://huggingface.co/briaai/Fibo-2.0-edit-turbo
- https://huggingface.co/briaai/Fibo-2.0-dev
- https://github.com/comfyanonymous/ComfyUI/pull/17240
- https://github.com/Bria-AI/vgl
- https://comfyui-wiki.com/en/news/2026-10-20-fibo-2-0
- https://alphasignal.ai/news/bria-s-fibo-2-0-matches-qwen-on-open-weights-image-benchmarks-at-half-the-price
- arXiv 2511.06876 (the FIBO structured-caption paper)
