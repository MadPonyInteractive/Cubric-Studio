# MPI-1339 Validation

## Phase 1 (2026-10-29) - ports in MpiNodes, NOT registered
- `detailer/`: 16 Mpi* nodes (MpiBboxDetectorSEGS, MpiDetailerForEachPipe, MpiFromBasicPipe, MpiToBasicPipe, MpiDilateMask, MpiMakeTileSEGS, MpiSEGSLabelAssign, MpiSEGSToMaskList, MpiSegsAndMask, MpiSimpleDetectorSEGS, MpiMaskDetailerPipe, MpiMaskToSEGS, MpiSAMLoader, MpiSEGSPreview, MpiSegsToCombinedMask, MpiUltralyticsDetectorProvider). Type strings kept (SEGS, BASIC_PIPE...), so a graph must switch to Mpi nodes throughout.
- Tests re-run by the orchestrator: `test_detailer.py` 24 passed, `test_detailer_ref.py` 10 passed, `test_detailer_ab_comfy.py` AB OK (bit-identical do_detail vs Impact on a tiny real-comfy UNet, 5 cases), `test_detailer_models.py` 4 passed (real YOLO + SAM vit_b weights; vendored SAM bit-equal to the pip package).
- Bbox detector: option (a), `ultralytics` stays the one extra pip dep (YOLO .pt are pickled ultralytics objects). SAM vendored (Apache-2.0), loads weights_only=True: `segment-anything` (python_deps.in:161) and `piexif` (:139) can go; scikit-image/dill/matplotlib/transformers maybe.
- Not ported: `{a|b}` / `__file__` / `<lora:>` wildcard expansion, hooks, refiner, segm models. Fixed upstream bugs: segs_scale_match w/h typo, RGBA crashes.

## For Phase 2
- JS names to update: comfyController.js SLASH_ONLY_NODE_TYPES, commandExecutor.js LOADER_CLASS_TYPES (SAMLoader), progressAggregator.js (~78), progressStages.js, routes/comfy.js, model dependency lists.
- Register as `from .detailer import ...`; the package registers `sams` / `ultralytics/*` model folders itself.
- Calls `DifferentialDiffusion.execute` directly (correct for core v0.42.1).
- Not run: real SDXL/Klein end to end on GPU -> the fixed-seed before/after.
- Noticed: tileDescribe.js cleanTileName does not strip `{} <> __`, which Impact used to expand.
