# MPI-1342 Validation

## Phase 1 (2026-10-29) - ports in MpiNodes, NOT registered
- `pano/` (MpiPanoWarp, MpiPanoHarmonizeBoundary, MpiPanoKrea2Reference, MpiPanoRollHorizontal, MpiPanoSeamMask), `stems/` (MpiAudioSeparation), `rife/` (MpiRifeVFI, RIFE 4.7 only).
- `tests/test_pano.py`, `test_stems.py`, `test_rife.py` green on the bench python (re-run by the orchestrator); outputs torch.equal to the original packs on fixed inputs.
- Pip left: pano torch/numpy/opencv; stems torch/torchaudio (no librosa, no moviepy); rife torch only. No ultralytics.
- Registry-safety changes: RIFE never downloads at runtime (missing weight = clear error), `torch.load(weights_only=True)`; real `rife47.pth` loads with all keys.

## For Phase 2
- Add the three test files to `.comfyignore` (they use importlib.util).
- RIFE weight: repoint `rife47` targetPath (assetDeps.js, routes/downloadCompletion.js, Pod bake in routes/remoteModels.js) to `models/rife`; the port also reads the old pack folder meanwhile.
- Upstream quirk kept for identical renders: the node passes fast_mode/ensemble positionally, so the Flow's `ensemble: true` never turns ensembling on.
- stems: hdemucs weight still comes from torchaudio's hub download on first run (as upstream).
