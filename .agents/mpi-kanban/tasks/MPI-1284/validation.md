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

- 2026-10-26 Re-run after f9f659076, the 5 s Singularity H3 Video Edit clip: PASSES Fabio's eye at 50% of the steps (motion settled in the live latents): she does NOT turn her back. Final file and its lag check still to come.

- 2026-10-26 Fast Motion above 768p, Video Edit Swap the person + picture, source flowVideoEdit_010 (576x1024, 39 frames, 24 fps), 960 chosen, RTX 4060 Ti 16 GB:
  - Original weight (flowVideoEdit_023): 960x1696 out, base 8 steps 5:01, refine 3 steps 5:29, 13:20 total, no OOM. Movement tracks the source; whole-clip lag -1..-2 frames (result slightly ahead; 1.6 s is too short for a firm number). Ending faces camera like the source, no back turn. Frame 0 arms differ from the source, locked by ~frame 5. PASS.
  - Singularity (flowVideoEdit_024): same size and timings (13:09), no OOM, so the route itself is weight-independent. FAIL on motion: it does not copy the source's moves (hands to chest / hair instead of hips then chin), mouth open throughout; lag correlation peaks 0.36 vs 0.55. Fabio agrees. Flow description + UNRELEASED now say H3 Reference copies the moves closest.
  - Side-by-side: scratchpad compare_src_old_singularity_960.mp4 (session a049398f).

## Not yet seen

- A real H3 Reference clip on Singularity. Needs an app restart to pick up the new dep list. Fabio's eye-test.
