# MPI-1243 validation

## Bench checks (G:\ComfyUi :8188, under gpu_lease, 2026-10-22)

- VAE: shipped `flux2-vae` vs bench `flux2-vae_small`, Turbo text + photo seed 1: 42.6 / 43.1 dB PSNR, no
  visible difference (`research/vae/results.jsonl`, `research/vaebench.py`). Ship `vae-flux2`.
- Boxes: the app's own `mossLayoutPrompt` output (run through node) as the prompt, Turbo 1024x1024: swapping
  the dog and cat boxes swaps their sides, "OPEN DAILY" exact (`research/boxes/strip.jpg`, `research/boxbench.py`).
- 2K: Turbo 1472x1472 photo coherent, 15 s sampler (1.9 s/it), 22 s wall, peak VRAM 12.9 GB cold.

## Not yet verified

- Enhancer recipe (none yet: `npm test` red on agent-corpus + recipe-registry with the ModelDef present).
- A run in the real app (`npm run app:isolated`), R2 upload + HEAD.
