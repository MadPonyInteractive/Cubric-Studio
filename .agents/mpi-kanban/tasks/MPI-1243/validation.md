# MPI-1243 validation

## Bench checks (G:\ComfyUi :8188, under gpu_lease, 2026-10-22)

- VAE: shipped `flux2-vae` vs bench `flux2-vae_small`, Turbo text + photo seed 1: 42.6 / 43.1 dB PSNR, no
  visible difference (`research/vae/results.jsonl`, `research/vaebench.py`). Ship `vae-flux2`.
- Boxes: the app's own `mossLayoutPrompt` output (run through node) as the prompt, Turbo 1024x1024: swapping
  the dog and cat boxes swaps their sides, "OPEN DAILY" exact (`research/boxes/strip.jpg`, `research/boxbench.py`).
- 2K: Turbo 1472x1472 photo coherent, 15 s sampler (1.9 s/it), 22 s wall, peak VRAM 12.9 GB cold.

## Verified 2026-10-22 (Moss image 4)

- `npm test` + lint green with the ModelDef, recipe and guide (pushed `d2dcca4ad` onward).
- Enhancer recipe `moss-image`: Stage 1 twice-green on DeepInfra Gemma 4 26B, 15/15 local 12B
  (`docs/recipes/research/moss-image/validation.md`).
- R2: the three weights byte-exact by `rclone lsl` and public Content-Length; no orphan multiparts.
- Real app (`npm run app:isolated`, own profile + documents, weights copied G: -> M:/CubricModels, under
  gpu_lease, `/connector/generate`, seed 1234):
  - Turbo t2i, bakery sign 1024x1024: 13.8 s; "ROSA'S BAKERY", "fresh bread since 1962", "OPEN" all exact.
  - SFT (`turbo: false`), same prompt + seed: 32.3 s; same three texts exact, softer, more natural.
  - Turbo + two boxes, 16:9 1344x768: 9.7 s; fox in its left box, bicycle in its right box. ComfyUI
    received MOSS layout JSON (`summary.caption` = the prompt, two `object` items, `abs_centralized`
    `yxyx`, edges checked by hand).

## Not yet verified

- Fabio's eye on the three images (user-ux).
- Enhance pressed in the app on MOSS (the recipe's Stage 2 renders).
