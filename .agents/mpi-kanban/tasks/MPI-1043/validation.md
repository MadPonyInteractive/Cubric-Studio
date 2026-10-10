# MPI-1043 Validation

Closed 2026-10-10 on Fabio's word ("the engine bump has been done ages ago"): the bump itself
is done, and every unchecked checklist line is a 2.0.2 release step that MPI-1044 already owns.

## Evidence (from checklist.md)

- Pins: `node_lock.json` + `system_dependencies.json` at v0.39.0 (`04b4f08eb`).
- Local engine upgraded in place 2026-10-08 on Fabio's dev app; `engine-floor-check` 220/220,
  no IMPORT FAILED.
- DEV Pod image `v0.25.0-dev` (cu130 + cpu) built, CI run 37786409120 both legs success,
  pull-verified; Pod reported 0.39.0 (gate 7).
- Smoke on RunPod: PASS 39, SKIP 3, FAIL 0 (`d27b5d8ba`, `dev_configs/smoke-evidence.json`).
- Qwen-Image 2.1 (skipped in that matrix): Fabio ran it on RunPod by hand, 2026-10-10.
- Master CI green on the latest runs (2026-10-10).

## Moved to MPI-1044 (already its blockers)

- mpi-ci `cubric-vision-pod/node_lock.json` MpiNodes sync to the app pin.
- 3D scene (MPI-623) scoped smoke.
- Clean RELEASE Pod image rebuild + the stable `POD_IMAGE_VERSION` pair (still v0.24.0).
- `/mpi-version-bump` 2.0.2.

The smoke-scope bug from § Noticed is card MPI-1068 (umbrella MPI-1064).
