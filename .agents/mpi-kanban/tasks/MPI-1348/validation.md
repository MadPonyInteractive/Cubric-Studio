# MPI-1348 Validation

**Verdict: REJECTED. The shipped H3 refine stays. Nothing in the app changed.**

Bench (G:\ComfyUi, RTX 4060 Ti 16 GB, shipped `minimax_h3_fl2va.json`, 2560x1408, 5 s / 124 frames,
seed 1348001, one stage-1 draft shared by every arm). Full numbers: `research/results.md`.

| arm | refine | face | detail |
|---|---|---|---|
| ship | ~12.7 min | keeps the draft's face | baseline |
| regen (LoRA 1.0, NVIDIA sigmas) | ~12.7 min | repainted (freckles gone, different woman) | much sharper crowd |
| regenshsg (LoRA 1.0, shipped sigmas) | same | repainted | sharper |
| regen50 (LoRA 0.5, NVIDIA sigmas) | same | holds | about the same as ship |

- Fits 16 GB at 2K (peak 15.6-16.0 GB whole card). No speed gain.
- Eye test: Fabio, 2026-10-29: "The one on the left beats all the other three every time" (left = ship).
- Not run, deliberately: seed 2, the seam test for MPI-1336 (only mattered if a variant won), macbox.
- Docs: `docs/models/h3/performance.md` § Open-H3-Regenerate-2K; README.md and ref2va.md point to it.
- Left on disk: `M:\CubricModels\loras\minimax-h3\minimax_h3_open_regenerate_2k_refiner_rank_384_bf16.safetensors`
  (5.87 GB, sha256-verified). Fabio's call whether to delete.
