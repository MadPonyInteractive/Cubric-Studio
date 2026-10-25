# MPI-1284 brief: MiniMax H3 Reference runs on Singularity H3 v2; both H3 models get sol-attn

## Decision (Fabio, 2026-10-25, MPI-1135 Phase 1e; replaces "Singularity is the only H3")

- **Singularity is not an image-to-video model.** Every LoRA tried on it (fal Realism People,
  Cinematic V2) lost the i2v first frame, so a user's own LoRA makes i2v a lottery; a prompt that
  describes the picture loses it too. Our old H3 Reference also came out as i2v at times, when no
  first frame was named.
- **MiniMax H3 (fl2va) STAYS** as the image-to-video model. Its only change: the approved speed
  method (sol-attn always on; non-turbo = sol-attn + EasyCache).
- **MiniMax H3 Reference keeps its name**; its base model becomes **Singularity H3 v2**
  (`Minimax-h3_Singularity_ref2va_v2_pruned_int8.safetensors`, 20.97 GB,
  WarmBloodAban/Minimax-h3_Singularity), plus the same speed method. Ours was the weak one there
  (more tearing).
- **Fast Motion (MPI-1285) lands in H3 Reference only**, never in MiniMax H3.
- **No LoRAs ship** from this bench; the tested ones are deleted.
- Nothing is deprecated in 2.1.3 (readiness card MPI-1286).
- v2 over v1.3: MPI-1135 Phase 1b. Singularity over ours on ref2v: Phase 1 / 1c.

## Before wiring

1. Licence: the source repo tags apache-2.0, but it is an H3 fine-tune, so treat it as bound by
   the H3 Community Licence and its territory clause (see the territory-restricted licence memory).
2. `docs/playbooks/add-model/README.md` § "Removing or re-tiering": the old ref2va transformer's
   dep entry is never deleted (the orphan sweep reads `DEPS`).
3. Ride-alongs from MPI-1135: MPI-1283 (sections in ref prompts), MPI-1285 (Fast Motion control).
   Phase 2 speed results (sol-attn / Veda / EasyCache) land in MPI-1135 `validation.md`.
4. Speed (MPI-1135 Phase 2, Fabio 2026-10-25): **sol-attn (core `BlockSparseAttention`) always on**;
   non-turbo = sol-attn + EasyCache. Veda out. Fast Motion / upscale-tier design: MPI-1285 brief.md.
   **Done on MPI-1285 (2026-10-25):** sol-attn is on the stage-1 model of BOTH graphs (r2va and
   fl2va, EasyCache kept on non-turbo), pinned by `tests/h3-fast-motion.test.cjs`. This card's
   speed half is closed; what is left here is the Singularity v2 weight swap on ref2va.
