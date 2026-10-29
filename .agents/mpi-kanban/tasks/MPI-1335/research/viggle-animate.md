# Viggle-Animate H3 — fallback for character replacement, to bench later

Source: https://github.com/Saganaki22/ComfyUI-Viggle-Animate-H3 (read 2026-10-29, README only;
not run). Original model: `huggingface.co/Viggle/Viggle-Animate`; ComfyUI files
`huggingface.co/drbaph/Viggle-Animate-ComfyUI`.

## What it is

A 33.1B full fine-tune of H3's `ref2va` transformer for ONE job: replace the performer in a
driving video with the character in a reference still. Motion, camera, timing, background and
light come from the video; identity from the still. So it overlaps Video Edit's "Swap the
person" in the video's room, not the picture's room, the head, the outfit or the background ops.

- **No prompt, no text encoder.** One frozen 362-token Qwen3-VL embedding
  (`fixed_embed_fwd_anyframe.safetensors`), the same on every render. Nothing to word wrong,
  and nothing to steer with either.
- **DMD2-distilled:** 3-7 model evaluations (sigma presets of 4/6/8 points), shift 3.0, through
  core nodes (BasicGuider, ManualSigmas). Our turbo graph runs 8 steps.
- **Both references nested on one canvas** at the short edge; the still should match the
  clip's pose and background.
- **Audio:** generated audio discarded, the driving clip's audio muxed back. Same as ours.
- **Lip sync: the author lists it as NOT reliable.** Not a fix for MPI-1335's mouth problem.

## How it does long clips (relevant to Infinite Video)

- Windowed conditioning: 124-frame windows, 22-frame overlap at 24 fps.
- Chunked sampler, `five_frame_anchor` (default): decode the previous chunk, re-encode its last
  five frames as anchors, advance 119 frames a window. `latent_overlap` kept for comparison.
- Seeds per chunk (`seed + n`); one chunk can be re-rendered, but every later one then must be.
- Loop mode checkpoints each chunk to disk (safetensors + `manifest.json`) and resumes after a
  crash or cancel. Worth comparing with our `MpiWindowedSampler` (overlap 17, grid 5).
- The author says chunking does NOT make any length fit: full-clip conditioning, the master
  latent and the final decode still scale with length (a 124-frame 1024x576 float32 chunk is
  ~0.82 GiB of RAM). Same question as MPI-1335's RAM item.

## Cost to ship

- Transformer: pruned int8 21 GB (the size of our ref2va pick), int8 47 GB, bf16 66.3 GB.
- DMD LoRA: r64 0.94 GB (recommended) or full 3.8 GB. VAE: ours already (fp16) or Kijai int8.
- Canvas tested 0.4-1.2 MP, 0.4-0.6 MP recommended for identity.
- Licence: node code Apache 2.0; weights are an H3 Model Derivative under the MiniMax H3
  Community License, so the existing `MINIMAX_H3` gate would cover it (check the model card).

## Author's limits

Identity drifts back to the driver when the subject leaves frame and returns; weak on poses far
from the still and fast motion; seams can show at chunk joins; lip sync unreliable.

## Bench (later, Fabio 2026-10-29)

Same clips as MPI-1335 step 5 (5 s speech clip, a dancer), same still, against Video Edit's
Swap the person: identity hold, motion sync (lag in frames), mouth vs source, seams on a clip
over 124 frames, wall time and peak RAM/VRAM. Use it if Video Edit gets blocked on swaps.
