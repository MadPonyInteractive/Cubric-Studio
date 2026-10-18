# MPI-1135 H3 base candidates: Singularity H3 and FastH3 Trim vs ours

Fabio, 2026-10-18: test BOTH against what we ship, then decide per candidate: **replace** our H3
base, **add** it as a separate model, or **drop** it.

## What we ship today (H3)

Pruned int8 base weights `minimax_h3_fl2va_pruned_int8_convrot` and
`minimax_h3_ref2va_pruned_int8_convrot`, the 8-step turbo / lightx2v 4-step speed LoRAs, the 3D
latent upscaler. Docs: `docs/models/h3/` (README, turbo.md, performance.md).

## Candidate 1: Singularity H3 (2026-10-13)

What people use now: better fast motion, less tearing, trained for fights. Bench vs our base, try
the upscalers from the video Fabio found it in, and pick the Story draft resolution (1344x768 may be
too high). Source / licence still to record here.

## Candidate 2: FastH3 Trim (FastVideo, 2026-10-18)

- Found in: https://www.youtube.com/watch?v=jePGw2RtkjQ (ComfyUI tutorial, 2026-10-12 workflows).
- Weights: https://huggingface.co/FastVideo/FastVideo-FastH3-Trim-Comfy (original:
  `FastVideo/FastVideo-FastH3-Trim-8-Step`), not gated, uploaded 2026-10-06.
- **Licence: `minimax-h3-community-license-agreement`**, the same licence as base H3. Re-read it for
  derivatives before shipping, but no new licence layer.
- What it is: an experimental pruned + distilled H3, **42 transformer blocks instead of 50**,
  rank-16 timestep conditioning, **8 steps**. Repo says 4.2x smaller than base H3 and faster than
  FastH3 V2.
- Files (diffusion model only; text encoder and VAEs are the standard H3 ones we already ship):
  int8_convrot 18.9 GB (any recent NVIDIA), fp8 19.7 GB (RTX 40+), nvfp4 11.9 GB (RTX 50), bf16
  37.5 GB.
- Settings from the repo: ComfyUI >= 0.36.0, the "FastVideo FastH3: Text to Video" template, 8 steps,
  `res_multistep` + `simple`, `MiniMaxH3SigmaShift` 10 (video) / 3 (audio). The video's author
  prefers Euler + beta/simple and uses Comfy Kitchen attention + VSA sparse attention.
- Claims from the video (RTX 4090, int8, not ours yet): 5 s at 1152x640 in ~38 s, ~15% faster than
  FastH3 V2 ("VIVU" in the captions); more tolerant than V2 in a two-stage latent upscale (0.2 MP x
  4 steps of high sigmas -> `MiniMaxH3 latent upscaler` -> 1 MP x 3 steps: 94 s vs 147 s
  single-stage at 1 MP, 10 s clip); handles slow-to-fast pacing when the prompt states the beats.
- Known weakness, shown in the video: on long clips (10 s, 1 MP) skin goes shiny / plastic and light
  overexposes toward the end. Their fix: **4 `MiniMaxH3AddGuide` keyframes over 10 s (frames 0, 60,
  160, 240)**. That is public evidence that mid-shot, multi-anchor guides run on stock core, which
  MPI-1134 / MPI-1191 had marked unproven.
- **Open: which ops it covers.** The video runs image-to-video (`MiniMaxH3ImageToVideo` first frame)
  and the repo names a text-to-video template. Whether it serves ref2va (our H3 Reference, Extend,
  Video Edit) or only t2v / i2v / fl2va decides "replace" vs "add".

## The bench (same for both candidates)

Same prompts, seeds, inputs and resolution as our current H3, one row per op the candidate claims:
quality (motion, tearing, faces / skin over a 10 s clip, audio), seconds per clip on Fabio's GPU,
VRAM / RAM peak, file size. Plus: the two-stage latent upscale on each, and the Story draft
resolution. Bench runs under the GPU lease (`gpu_lease.py run`). Downloads are tens of GB each: say
the size before pulling.

## Output

A verdict per candidate in `validation.md`: replace / add as a separate model / drop, with the
evidence. A pass becomes the `/mpi-add-model` job (on this card or a new member card under MPI-1179).
