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

## Clip lengths: 2-5 s, never months of tests (Fabio, 2026-10-18)

- **Every arm runs at 2-5 s.** They run fast and settle most questions; H3 is trained from ~4 s up,
  but 2-5 s works fine for comparisons. Story and Infinite Video rarely go past that per shot.
- **15 s: ONE run only**, to check that the windowed refine still fits in VRAM. Not a quality arm.
- Known blind spot, accepted: the late-clip plastic skin seen at 10 s will not show at 2-5 s.

## Step 0, BEFORE the model bench: three upscale arms (Fabio, 2026-10-18)

Fix the upscale first, so the model comparison is not judged through a weak upscale. Same clip,
seed and prompt on our current H3, three arms:

1. **No upscale**: one stage at the target size.
2. **Ours today**: stage 1 low-res -> `MinimaxH3LatentUpscaler3D` (LBH-123-AI `3d_conv_v1`, which we
   ship) -> stage-2 refine sampled in temporal windows (`MpiWindowedSampler`,
   `docs/models/h3/windowing.md`), turbo on the refine leg.
3. **Benji's** (AI Future Tech, https://www.youtube.com/watch?v=r39Ej4L2dO4 ~8:26, Fabio's
   screenshot 2026-10-18; he credits it for his recent no-tearing results, together with Singularity
   H3):
   - `MMH3 Ultimate Upscale` from https://github.com/bbaudio-2025/Comfyui-MMH3-UltimateUpscale
     (MIT). One node: temporal chunks (`chunk_length 85`, `temporal_overlap 17`,
     `anchor_strength 1.0`), the same LBH 3D latent upscaler, then SPATIAL tiles (128 overlap,
     32 fade, `min_tile_size 256`, linear blend), only one tile in VRAM at a time; audio carried
     through unsampled. New since: `MMH3 Tiled Diffusion` (experimental, claims no seams).
   - **`minimax_h3_lms_v1.0_r64` LoRA at 0.70 on the refine only**: Alissonerdx's sharpness/detail
     LoRA (https://huggingface.co/Alissonerdx/Minimax-H3-ComfyUI, `docs/lms.md` there; RunningHub
     re-host `RunningHubAI/rh-minimax-h3-lms-v1.0-r64-lora`, 1.18 GB). **Licence: none stated**:
     the repo's custom licence covers only Character Swap, the same gap as the Head Swap LoRA in
     MPI-1133. Ask the author before shipping. The same repo also has an experimental
     `h3_upscaler_lms_v0.1` latent upscaler (LBH upscaler fine-tuned on the LMS data): add it as a
     fourth arm if arm 3 wins.
   - Refine: euler, beta, 2 steps, denoise 0.30, target 2.0 MP (his 15 s test at 1.5 MP gave 1080p).
   - Benji: better than ours-shaped upscales but slower. Measure both.

Measure per arm: sharpness / detail, seams (spatial and temporal), tearing, flicker, audio intact,
seconds, VRAM peak, at 2-5 s (plus the one 15 s VRAM check on the winner). Winner = the upscale every model arm below uses. If arm 3 wins,
it also feeds MPI-688 (Video Upscale: add H3) and the H3 Flows' refine.

## Speed: Veda sparse attention (test alongside, not a model)

- What: learned sparse attention for H3. A small fp8 predictor skips ~70-90% of attention tiles; the
  backbone is untouched, so it stacks with LoRAs, turbo and Sage / Comfy Kitchen attention. Node
  `Veda-on-ComfyUI` (https://github.com/veda-sparse/Veda-on-ComfyUI, MIT, in ComfyUI-Manager) goes at
  the end of the model chain; predictors in `models/veda/`: T2VA/FL2VA
  `minimax_h3_t2va_veda_8nfe_600step_preview_fp8` and R2VA `minimax_h3_r2va_veda_preview_fp8`
  (`Veda-Sparse/*` on HF, licence "other": read it). Site: https://veda-sparse.github.io/
- Claims: 3x end-to-end on long clips (RTX PRO 6000), 1.77-2.82x on a 4090; gains grow with length.
- Benji's run (5090-class, R2VA, 15 s, 0.7 MP): stage 1 2:51 -> 1:57; 10 s at ~1:17 with 72% of
  attention skipped. **His verdict: same quality on talking / drama / simple camera moves, worse on
  fast complex motion** (coin-flip hands morph; "5-6 usable out of 10").
- **RTX 30 is unverified by the author**: our photographer tester runs a 3060. Test there too, or
  ship it behind a toggle that defaults off on Ampere.
- The FastH3 Trim video uses a different sparse mode (VSA, picked on the model loader with Comfy
  Kitchen attention).
- **Veda vs EasyCache: different skips, so they may stack.** EasyCache skips WHOLE STEPS (reuses
  the last output when the change is small); Veda skips attention TILES inside every step. Ours:
  EasyCache is gated OFF on turbo, because at 8 steps it skips 0 and only adds overhead
  (`docs/models/h3/turbo.md` § "EasyCache is gated OFF turbo"). So on turbo Veda is the only one of
  the two that can help; on the non-turbo quality path both can.
- **Best speed-up setup**, on the winning upscale, turbo and non-turbo: none / EasyCache / Veda /
  VSA / Veda + EasyCache (non-turbo only). Measure seconds and fast-motion quality (a hands / action
  prompt, Benji's weak spot).

## The bench (same for both candidates)

Same prompts, seeds, inputs and resolution as our current H3, one row per op the candidate claims:
quality (motion, tearing, faces / skin, audio; 2-5 s clips), seconds per clip on Fabio's GPU,
VRAM / RAM peak, file size. Plus: the two-stage latent upscale on each, and the Story draft
resolution. Bench runs under the GPU lease (`gpu_lease.py run`). Downloads are tens of GB each: say
the size before pulling.

## Output

A verdict per candidate in `validation.md`: replace / add as a separate model / drop, with the
evidence. A pass becomes the `/mpi-add-model` job (on this card or a new member card under MPI-1179).
