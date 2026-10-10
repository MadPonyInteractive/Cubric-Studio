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

## A/B: stock vs Texture-Fix VAE (2026-10-10, G: bench, GPU lease, Fabio OK'd the download)

- Shipped `comfy_workflows/qwen_image_2_1.json` t2i, Fabio's own prompt + seed + size for
  t2i_018, t2i_020, t2i_022 (the last two with the No Background sentences); ONE latent per
  card, decoded by both VAEs (extra VAEDecode on node 70). The stock decode of t2i_018 is
  byte-identical to Fabio's card (mean |diff| 0.0), so the test reproduces the app exactly.
- 2-px checker score, stock -> fix: t2i_018 28.2 -> 3.1, t2i_020 38.2 -> 2.9, t2i_022 33.0 -> 1.4
  (other models' cards score 0.3-1.7). After Siax 2x: 44.3 / 31.5 / 21.1 -> 11.0 / 10.2 / 10.4.
- Alpha unchanged: t2i_020 33.5% clear / 1.9 vs 1.8% partial, t2i_022 58.6 vs 58.9% clear,
  16.2% partial both. The fix decoder outputs RGBA like the stock one.
- Picture otherwise the same: mean |fix - stock| 1.06/255 on t2i_018 (5.5 and 10.1 on the
  transparent cards, where invisible fully-clear pixels differ).
- Eye: research/stock-vs-texturefix-siax2x.png (Siax 2x crops at 200%) and the two t2i_018
  crops: grid on skin and fabric with stock, gone with the fix.
- File: madebyollin/texture-fix-vae-for-qwen-image-2.1,
  `texture_fix_vae_for_qwen_image_2.1_bf16.safetensors`, 675,509,688 bytes (same size as the
  stock VAE), now in `G:/ComfyUi/ComfyUI/models/vae/` (bench only). Licence qwen-research.

Tools: scratchpad vaeab.py / vaeab_report.py, sheet.py / upcmp.py / checker.py / pick.py / qcmp.py (session 3c24ca48).

## Shipped (2026-10-10)

- `a6d69fc80` fix(MPI-1066): models.js qwen-image-2-1 depends on `vae-qwen-image-21-texturefix`, plus the 3 runtime graphs, qwen-image-2 README and UNRELEASED.md. Built from HEAD through a private index; MPI-1060's uncommitted models.js hunks left in the tree untouched.
- `npm test`: 3039 pass, 0 fail, 2 skipped. CI run 38090774918 on a6d69fc80: success.
