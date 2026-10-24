# MPI-1135 checklist

Bench phase first: every arm runs on the standalone bench (`G:\ComfyUi`, port 8188), nothing in
the app changes until a verdict. Test plan: `plan.md`.

- [x] Weights on disk (M:\CubricModels `bench-mpi1135/` subfolders; Veda in the bench's `models\veda`); Singularity and FastH3 Trim sha256 match HF (2026-10-24)
- [x] Custom nodes on the bench (2026-10-24): `Comfyui-MMH3-UltimateUpscale` @0a8d5ee, `Veda-on-ComfyUI` @67e4eb5; no new pip packages (triton-windows 3.7 already there). Bench restarted, classes load, Veda sees both predictors, loader sees both candidates. Bench GPU: RTX 4060 Ti, ComfyUI v0.42.1
- [ ] Test inputs fixed: 2 prompts (run at camera, side tracking run), start images, seeds
- [ ] Step 0: three upscale arms on our H3 (none / ours / Benji's + LMS LoRA)
- [ ] Model bench: ours vs Singularity v2 vs FastH3 Trim at 2-5 s, on the winning upscale
- [ ] Speed arms: none / EasyCache / Veda / VSA / Veda + EasyCache
- [ ] 10 s skin pass on the survivors, one 15 s VRAM run on the winner
- [ ] Story draft resolution picked
- [ ] Verdict per candidate in `validation.md`: replace / add / drop
