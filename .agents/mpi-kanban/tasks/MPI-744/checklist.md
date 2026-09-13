# MPI-744 Checklist

Bench work in the ComfyUI node graph: owns no repo file yet, so `files.json` is the empty
default. App wiring comes after the bench, through `/mpi-add-flow`, and seeds `files.json` then.
LoRA facts and open decisions live in the card description; do not repeat them here.

## Bench

- [x] 1 - Klein 9B, no crop-stitch: first run about 20s, result "not too bad" (Fabio, 2026-09-13).
- [ ] 2 - Klein 9B LoRA A/B: `step3500_rank128` vs `step3750_rank64`.
- [ ] 3 - Klein 4B A/B: `bfs_head_v1` (README-recommended) vs the undocumented `v1.1_optional`.
- [ ] 4 - Crop-stitch vs full frame, on the winner.
- [ ] 5 - Side by side with the shipped Qwen Head Swap Flow: same plates, time and quality.
- [ ] 6 - Decide: crop-stitch or not. **DECIDED by Fabio 2026-09-13: Qwen is DROPPED; the Flow
      supports Klein 9B and Klein 4B only, on the lcm sampler.** Fabio has authored the new graph
      at the bench; not yet exported to `comfy_workflows/raw/`.

## App (after item 6)

- [ ] 7 - Wire through `/mpi-add-flow`; seed `files.json` before the first edit.
