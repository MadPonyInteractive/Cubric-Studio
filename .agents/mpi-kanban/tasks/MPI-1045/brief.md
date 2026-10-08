# MPI-1045 brief

Retire the Image Describer plugin. Descriptions and ComfyUI enhance follow the Remote pick;
the ComfyUI pick runs on Qwen3-VL-4B abliterated (`qwen3vl-abliterated-clip`), which becomes an
engine dependency installed with ComfyUI (Fabio, 2026-10-08). Must land before MPI-1036
(Video Edit Flow) ships. Audit: `research/audit.md`.

## Noticed
