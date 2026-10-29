# MPI-1341 - port the KJNodes we use into MpiNodes

Member of the MPI-1344 Engine diet umbrella; cross-cutting rules in `.agents/mpi-kanban/tasks/MPI-1344/plan.md`.

## Phase 1: port in MpiNodes (parallel batch)
Source pack: comfyui-kjnodes (`G:/ComfyUi/ComfyUI/custom_nodes/comfyui-kjnodes/`). Nodes:
- ColorMatch
- GetImageRangeFromBatch
- GrowMaskWithBlur
- ImageBatchExtendWithOverlap
- ImageBatchMulti
- ImageResizeKJv2
- LTX2_NAG
- LTXVAudioVideoMask
- LoraExtractKJ
- VAELoaderKJ
- ImageConcanate (paid Head Swap Flow, audit could not see it)

New Mpi* names; package exposes its own mappings, NOT registered in `__init__.py`. Keep GPL-3 notices.
Keep-or-drop of the LTX nodes (LTX2_NAG, VAELoaderKJ, LTXVAudioVideoMask) is decided in Phase 2; Phase 1 ports all and reports the trade-off.

Ownership: `kj/**`, `tests/test_kj*.py` in `C:/AI/Mpi/ComfyUi-MpiNodes/`.

**Verify:** each `tests/test_kj*.py` green with `G:/ComfyUi/python_embeded/python.exe <file>` on CPU, tiny inputs; output matches the original pack on fixed inputs where importable.

## Phase 2: swap over (serial, see umbrella)
Register, pin, swap class_types (incl. the paid Head Swap package), drop the pack, before/after run, release note.
