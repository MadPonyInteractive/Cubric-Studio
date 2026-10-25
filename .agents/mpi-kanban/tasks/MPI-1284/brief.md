# MPI-1284 brief: Singularity H3 becomes the only MiniMax H3 model

## Decision (Fabio, 2026-10-25)

- **Singularity H3 v2** (`Minimax-h3_Singularity_ref2va_v2_pruned_int8.safetensors`, 20.97 GB,
  WarmBloodAban/Minimax-h3_Singularity) is the ONE MiniMax H3 model, for t2v, i2v and ref2v.
  "Fewer weights, better results, win-win."
- **2.1.3, the MOSS release** (readiness card MPI-1286): mark both current H3 models DEPRECATED, MiniMax H3 (fl2va) and MiniMax H3
  Reference (ref2va), and release Singularity H3.
- v2 over v1.3: MPI-1135 Phase 1b (Shot B, Fabio's verdict). Singularity over ours: Phase 1.
  v2 on i2v (Shot D) and ref2v (Shot Cs) runs as MPI-1135 Phase 1c, a final check that does not
  hold this decision back.

## Before wiring

1. Licence: the source repo tags apache-2.0, but it is an H3 fine-tune, so treat it as bound by
   the H3 Community Licence and its territory clause (see the territory-restricted licence memory).
2. `docs/playbooks/add-model/README.md` § "Removing or re-tiering": deprecate, never delete the old
   dep entries (the orphan sweep reads `DEPS`).
3. Ride-alongs from MPI-1135: MPI-1283 (sections in ref prompts), MPI-1285 (Fast Motion control).
   Phase 2 speed results (sol-attn / Veda / EasyCache) land in MPI-1135 `validation.md`.
4. Speed (MPI-1135 Phase 2, Fabio 2026-10-25): **sol-attn (core `BlockSparseAttention`) always on**;
   non-turbo = sol-attn + EasyCache. Veda out. Fast Motion / upscale-tier design: MPI-1285 brief.md.
