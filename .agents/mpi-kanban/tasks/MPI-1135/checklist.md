# MPI-1135 checklist

Bench phase first: every arm runs on the standalone bench (`G:\ComfyUi`, port 8188), nothing in
the app changes until a verdict. Test plan: `plan.md`.

- [x] Weights on disk (M:\CubricModels `bench-mpi1135/` subfolders; Veda in the bench's `models\veda`); Singularity and FastH3 Trim sha256 match HF (2026-10-24)
- [x] Custom nodes on the bench (2026-10-24): `Comfyui-MMH3-UltimateUpscale` @0a8d5ee, `Veda-on-ComfyUI` @67e4eb5; no new pip packages (triton-windows 3.7 already there). Bench restarted, classes load, Veda sees both predictors, loader sees both candidates. Bench GPU: RTX 4060 Ti, ComfyUI v0.42.1
- [x] RunPod bench volume `cubric-h3-bench` filled and verified on the PRO 4500 (2026-10-25): nodes load (1145 classes), 14 weights full size, torch 2.12+cu130 / triton 3.7 see the GPU; boot to ready ~2-3 min
- [x] Test inputs fixed: 2 prompts (run at camera, side tracking run), start images, seeds
- [x] Step 0: three upscale arms on our H3 (none / ours / Benji's + LMS LoRA)
- [x] Model bench: ours vs Singularity v2 vs FastH3 Trim at 2-5 s, on the winning upscale
- [x] Speed arms: none / EasyCache / Veda / VSA / Veda + EasyCache
- [x] ~~10 s skin pass on the survivors, one 15 s VRAM run on the winner~~ dropped by Fabio (Phase 1d: one clip instead)
- [x] ~~Story draft resolution picked~~ moot: no base swap for MiniMax H3; Story keeps its Singularity workflow
- [x] Verdict per candidate in `validation.md`: replace / add / drop
- [x] Cosmo H3 guide tested in the app by Fabio (2026-10-25): named model wins, no warning, no restating the picture
