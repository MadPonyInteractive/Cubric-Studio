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

## Phase 2 (2026-10-29) - swap, verified
- MpiNodes e33694d (pushed): pano/ stems/ rife/ mappings merged in __init__.py (160 nodes import), README
  section, changelog line; test_pano/test_stems/test_rife re-run green.
- Swap: 45 names in 6 files (flow_pano360, flow_stems, video_interpolate + raw/), raw provenance -> MpiNodes
  e33694d. `_meta` titles kept (injection keys). node_lock: MpiNodes pinned e33694d, the 3 packs out.
  nodesDeps.js: 3 entries out (one note). flowsRegistry stems requiredDeps -> [] (Stems is now available
  with nothing to install). compile-node-deps: REQUIREMENTS_FILE map gone (dead), DROPPED reasons
  reworded; python_deps.in comments only (--check OK: kornia/librosa/opencv still declared by others).
- rife47 targetPath -> `models/rife` (a weight-only custom_nodes folder = IMPORT FAILED every boot).
  Existing users re-fetch 20 MB once; MpiRifeVFI also reads the old folder. Pod: see MPI-1344 Plan Drift.
- Tests: node-drift (path), inject-params-titles (+MpiPanoHarmonizeBoundary), flow-legs (stems available),
  smoke-flows (stems no flowDepIds), flow-uninstall-guard case 5 -> minimax-music. lint OK; npm test
  3807 / 0 fail.
- Packs gone: bench CPU engine without the 3 packs + both Impact packs -> check_nodes "ALL PRESENT"
  (4203 nodes, paid Flows included), no IMPORT FAILED.
- Fixed-seed A/B (`research/ab/run_ab.sh`, gpu_lease, report.txt): interp mp4 bytes IDENTICAL; stems 4 flac
  and pano Output_Image decoded IDENTICAL (bytes differ only in metadata naming the classes).
