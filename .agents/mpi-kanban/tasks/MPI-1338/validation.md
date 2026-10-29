# MPI-1338 Validation

## Phase 1 (2026-10-29) - ports in MpiNodes, NOT registered
- `preprocess/`: MpiAIOPreprocessor (AIO_Preprocessor), MpiDepthAnythingV2 (DepthAnythingV2Preprocessor), MpiOpenpose (OpenposePreprocessor). Inputs identical.
- AIO needs 4 annotators of ~40: Canny, DepthAnythingV2, Openpose, Scribble (all saved workflows + models.js controlTypes; JS never sets `preprocessor`).
- `tests/test_preprocess.py` (18 passed) and `tests/test_preprocess_equivalence.py` (6 checks) green, re-run by the orchestrator. Equivalence against the real pack with real weights: depth vits bit-identical, openpose image+JSON identical on 3 photos, canny/scribble exact.
- Pip: none beyond the engine (torch, numpy, opencv, scipy); the pack's 25 go. One deliberate change: a flat depth map gives black instead of NaN-cast garbage.
- Weights: same names/layout; lookup `models/preprocess/<repo>/<file>` then the old pack's `ckpts/`. The port never downloads.

## For Phase 2
- The pack auto-downloaded weights; the port does not. Phase 2 must add deps for depth vits, vitl (AIO depth default), body/hand/face pose, to `models/preprocess/<repo>/<file>`, and the folder map must cover `preprocess`. Fix the "auto-download on first use" comments in models.js / nodesDeps.js.
- LICENCE (Fabio's call, already true today via the pack): OpenPose code + weights are CMU non-commercial research only; DepthAnything V2 Base/Large/Giant are CC-BY-NC-4.0 (AIO depth uses Large). Small (vits) is Apache-2.0.

## DECIDED 2026-10-29 (Fabio) - not ported, the pack stays a dependency
Any pack whose licence (code or weights) carries a commercial restriction stays as a plain dependency: no port, no rewrite, no asking the author. The working port is shelved outside the repo (session scratchpad shelved-ports/), never committed. Card closed rejected.
