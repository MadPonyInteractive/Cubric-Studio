# MPI-1341 Validation

## Phase 1 (2026-10-29) - ports in MpiNodes, NOT registered
- `kj/`: MpiColorMatch, MpiImageRange, MpiGrowMaskBlur, MpiImageBatchExtend, MpiImageBatchMulti, MpiImageResize, MpiLTX2NAG, MpiLTXAudioVideoMask, MpiLoraExtract, MpiVAELoader, MpiImageConcat (Head Swap). Inputs identical to KJ.
- `tests/test_kj_image.py`, `tests/test_kj_ltx.py` green (re-run by the orchestrator). Bit-equal to KJ on fixed inputs (resize 740 combos, mask 72 sets, NAG attention forward on a tiny core CrossAttention); LoRA SVD within ~1e-7.
- Pip: none beyond the engine. color-matcher (python_deps.in:86) and mss (:87) go with the pack; matplotlib/kornia are shared pins - check against the other ports.
- Narrowed: ColorMatch mkl only; no nvidia_rtx_vsr, no perceptual_crossfade; VAELoader lists `vae` only. Errors no longer swallowed (ColorMatch, LoraExtract).
- Licence: KJ GPL-3, no preamble (all pack LICENSE openings swept 2026-10-29: only RES4LYF has one).

## For Phase 2
- Untested without weights: NAG on a real LTX 2 model, MpiVAELoader on the real audio VAE, LoraExtract on a real ModelPatcher -> add an LTX NAG smoke to Phase 3.
- Re-export the paid Head Swap package (nodes 116/117 ImageConcanate, GrowMaskWithBlur).
- `.comfyignore`: add `tests/test_kj*.py` (and the other new tests).
- LTX keep-or-port: worker's pick is port all three and drop the pack; NAG is the fragile one (patches attn2 forwards; core attention already drifting).
