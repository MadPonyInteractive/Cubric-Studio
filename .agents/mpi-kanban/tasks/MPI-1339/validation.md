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

## Phase 2 (2026-10-29) - swap, A/B pending
- MpiNodes 5e37b38 (pushed): detailer mappings merged in __init__.py, README section, changelog line.
- Scratch engine (bench, CPU) with Impact packs EXCLUDED: all 16 Mpi nodes register, YOLO + SAM lists fill.
  Required inputs and outputs match Impact's per object_info; only unported optional sockets differ
  (hooks, refiner pipe, scheduler_func, segm detector) and no graph wires them.
- Swap: 590 names in 35 files, cnr_id/ver set to MpiNodes 5e37b38 in raw/. JS: comfyController
  SLASH_ONLY_NODE_TYPES, commandExecutor LOADER_CLASS_TYPES, progressAggregator detailer kinds, 3 tests.
  "# of detected SEGS" log still matches routes/comfy.js (case-insensitive regex).
- Deps: node_lock pin + both Impact entries out, nodesDeps.js note, models.js 16 lines, python_deps.in
  -dill -piexif -segment-anything (compile --check OK, .txt diff = those 3), ultralytics commented.
- lint OK; npm test 3802 pass / 0 fail. Audit: Impact packs 0 nodes. UNRELEASED.md names the removed classes.
- PENDING: fixed-seed A/B `research/ab/run_ab.sh <scratch>` under gpu_lease (SDXL detail, SDXL tiles,
  auto-mask box, auto-mask SAM3 text; before = HEAD graphs in <scratch>/before). Expect identical pixels.
