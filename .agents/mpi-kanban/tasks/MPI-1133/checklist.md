# MPI-1133 checklist

- [x] Extract frames from Fabio's ref2v_001 clip, compare faces with both sheets, write the drift list
- [x] Read H3 docs (README, ref2va, windowing, turbo) + MPI-1096 shortlist method
- [x] Check bench nodes: ComfyUI-MiniMax-H3-Turbo, ComfyUI-VDN-H3, BFSNodes (local 1.4.0 vs upstream H3 identity tooling)
- [x] Survey: identity LoRAs / IC-LoRAs / adapters for H3; per-character LoRA training; face-swap post pass; prompt + reference-layout levers
- [x] Per option: licence (read by hand), 16 GB VRAM, ComfyUI nodes, composes with ref2va multi-reference; UNVERIFIED marked
- [x] research/shortlist.md: ranked shortlist + bench plan
- [x] Report to Fabio: higher resolution fixes it (2026-10-14); RefMod folded into MPI-815
