# MPI-1284 validation

## Agent evidence (2026-10-26)

- Runtime `comfy_workflows/minimax_h3_r2va.json` node 517 loads
  `Minimax-h3_Singularity_ref2va_v2_pruned_int8.safetensors` (one-line diff, rebuilt by orchestrate.py;
  the raw->API convert needed a live ComfyUI, so the same scalar was written into the API template).
- Weight moved from `M:\CubricModels\diffusion_models\bench-mpi1135\` to `diffusion_models\`;
  sha256 d7637c2c...3f9f and 20967647456 bytes match the dep entry and HF.
- The user's engine (:48188) lists both the Singularity file and the original ref2va file under UNETLoader.
- Video Edit Flow keeps the original weight and now declares `minimax-h3-ref2va-transformer` in requiredDeps.
- lint clean, 3686 tests pass (0 fail); pre-push gate green on 5d3e0674a.

- 2026-10-26 Singularity H3 Video Edit, 7 s, Swap the person + picture, keep room (flowVideoEdit_021 in "MPI-1036 Video Edit in-app", 576x1024, 158 frames at 24 fps, 1005 s): IN SYNC (Fabio by ear; whole-frame lag search vs the source resampled to 24 fps stays 0..+2 frames, the long +10 ramps are held poses). The 5 s fail is no longer in the project, not measured. FAULT: from ~6.2 s she turns her back while the source faces the camera, fists up = the V6o back-turn primer. Template 1 clause dropped (picture + no-picture), raw 6a6b49107, API regenerated, builder == API 107/107 nodes 0 diffs, inject-params-titles + user-flows + workflow-media-slots 64/64. NOT re-run yet (Fabio).

## Not yet seen

- A real H3 Reference clip on Singularity. Needs an app restart to pick up the new dep list. Fabio's eye-test.
