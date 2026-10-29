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

## Phase 2 (2026-10-29) - swap, verified
- MpiNodes d72ef49 (pushed): kj/ mappings merged in __init__.py, README section, changelog line; test_kj_image +
  test_kj_ltx re-run green. Vision pins d503a6d (= d72ef49 + MpiWindowedSampler auto window, pinned by MPI-1350
  in 98c883f8b).
- Audit beyond the card: shipped API graphs use only the 10 + ImageConcanate (Head Swap). raw/ templates also
  carry SetNode/GetNode (resolved by the API export), muted LTXVImgToVideoInplaceKJ/DrawMaskOnImage, a live
  GetImageSizeAndCount in the unshipped lipdub template, and ModelSaveKJ in the Model Merger script. Left as is:
  authoring-only, the bench keeps KJNodes.
- Swap: 137 nodes in 61 files (API + raw + scripts/workflow_generation + generate_flux3.py), text-level so
  formatting is untouched, each file proven equal to the intended JSON mutation; raw provenance -> ComfyUi-MpiNodes
  d72ef49. node_lock: kjnodes out. nodesDeps.js: entry out (one note). models.js: 19 dep lines out.
  python_deps.in: color-matcher, mss out; python_deps.txt regenerated (color-matcher, ddt, docutils, mss gone,
  nothing else moved); --check OK.
- Tests: control-custom-size, flux3-edit-size, inject-params-titles -> Mpi names. lint OK; npm test 3816 / 0 fail.
- Packs gone (`research/run_nokj.sh`): CPU bench engine without kjnodes -> every shipped graph node present, no
  IMPORT FAILED; the only misses were the installed paid Head Swap 1.0.0 (GrowMaskWithBlur, ImageConcanate).
- Fixed-seed A/B (`research/ab/run_ab.sh` under gpu_lease, report.txt): flow_ltx_extend (NAG, AV mask, VAE loader,
  batch extend, image range, resize) mp4 bytes IDENTICAL; 12 mini cases (every shipped ColorMatch,
  GrowMaskWithBlur, ImageBatchMulti, ImageResizeKJv2, ImageConcanate setting, Head Swap included) decoded
  IDENTICAL. LoraExtract only unit-tested (dev Model Merger script, not a user path).
- Head Swap package (c:\AI\Mpi\Cubric-Flows): 3 nodes swapped, version 1.1.0, minAppVersion 2.1.4 (1.0.0 got
  KJNodes through klein-9b's deps and breaks once this ships); checks.test 7/7; zip rebuilt. Gumroad re-upload
  is Fabio's.
- CI on be78fb41d (run 40949065013): unit + 4 desktop shards green, 2026-10-29. Closed.
