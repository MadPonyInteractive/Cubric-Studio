# MPI-1066 Validation

## Findings (2026-10-10, session 3c24ca48, no GPU used)

- Fabio's upscale_006 (Qwen 2.1 upscale, 2x, denoise 0.20, default Siax, project "Qwen 2.1"):
  crosshatch on skin and cloth. At 200%: a plain lanczos 2x of the same source is clean,
  Siax alone (imageUpscale_001) carries the grid, the Qwen pass at 0.20 keeps it.
- The source itself carries it. A 2-px checker (FFT diagonal Nyquist band / mean high-freq)
  scores 10-54 on EVERY Qwen 2.1 card in the project (t2i, control, edit, detail, upscale)
  and 0.3-1.7 on Krea 2, Klein 4B/9B, SDXL, Illustrious, Nano Banana, Gemini (22 cards).
  Fabio saw it zoomed on t2i_018 too. Siax doubles it to a 4-px grid at 2x.
- CPU run of six upscalers on resize_001: Siax and Remacri amplify the grid; ClearRealityV1,
  UltraSharp, RealESRGAN_x2plus, RealisticRescaler come out clean (they smooth it away).
- Cause per the community: the stock 2.1 VAE DECODER stamps a 2-px checker. Fixes found:
  madebyollin/texture-fix-vae-for-qwen-image-2.1 (decoder-only finetune, drop-in in Load VAE,
  same latents; licence qwen-research = non-commercial, same as 2.1 itself; alpha output not
  stated), and a "Nyquist notch" post-filter node (DioBrando nodes).
- Shipped graph: int8_convrot UNet, euler/simple 30 steps, cfg 1, qwen_image_2.1_vae_bf16.
  Steps/sampler cannot explain a grid that a zero-step Siax pass already shows on the source.

Tools: scratchpad sheet.py / upcmp.py / checker.py / pick.py / qcmp.py (session 3c24ca48).
