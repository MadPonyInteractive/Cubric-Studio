# MPI-1342 - port the pano, stems and RIFE nodes into MpiNodes

Member of the MPI-1344 Engine diet umbrella; the cross-cutting rules (licence, new `Mpi*`
names, ports keep behaviour) are in `.agents/mpi-kanban/tasks/MPI-1344/plan.md`.

## Phase 1: port in MpiNodes (parallel batch)
Source pack: ComfyUI-Mickmumpitz-Nodes, audio-separation-nodes-comfyui, comfyui-frame-interpolation (read it from `G:/ComfyUi/ComfyUI/custom_nodes/`). Nodes we use:
- MickmumpitzPanoHarmonizeBoundary
- MickmumpitzPanoKrea2Reference
- MickmumpitzPanoRollHorizontal
- MickmumpitzPanoSeamMask
- MickmumpitzPanoWarp
- AudioSeparation
- RIFE VFI

Port only the code paths our workflows reach (`comfy_workflows/*.json` show the input
values set). Every class gets a NEW `Mpi*` name; the module exposes its own
`NODE_CLASS_MAPPINGS` / `NODE_DISPLAY_NAME_MAPPINGS` and is NOT registered in
`__init__.py` (Phase 2 does that). Keep upstream licence notices.

Ownership: `pano/**`, `stems/**`, `rife/**`, `tests/test_pano*.py`, `tests/test_stems*.py`, `tests/test_rife*.py` in `C:/AI/Mpi/ComfyUi-MpiNodes/`.

**Verify:** each of `tests/test_pano*.py`, `tests/test_stems*.py`, `tests/test_rife*.py` runs green with `G:/ComfyUi/python_embeded/python.exe <file>` on
CPU with tiny inputs; where the original pack code can be imported, the port's output
matches it on fixed inputs.

## Phase 2: swap over (serial, see umbrella)
Register nodes, pin via `/mpi-nodes-sync`, swap `class_type`s keeping input values, drop the
pack from `node_lock.json` / `nodesDeps.js` / model deps / `python_deps.in`, fixed-seed
before/after run, release note naming the removed classes.
