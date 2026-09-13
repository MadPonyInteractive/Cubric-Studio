# MPI-348 Checklist

Picked up 2026-09-13 for the BFS (Best Face Swap) LoRA bench. Bench work in the ComfyUI node
graph: owns no repo file, so `files.json` is the empty default. A swap that earns a Flow gets
its own card and goes through `/mpi-add-flow`. Klein and LTX BFS LoRAs are NOT this card.

## BFS Krea 2 inputs (`Alissonerdx/BFS-Best-Face-Swap`, checked 2026-09-13)

- `bfs_head_swap_v1.1_krea2.safetensors` - rank 128, F16. Trigger
  `head_swap: replace the head with the reference head.` Workflow
  `workflows/Head Swap Krea 2 - V1 Simple Workflow.json`.
- `bfs_body_swap_v1_krea2.safetensors` - rank 128, 4000 steps, experimental. Trigger
  `body_swap: replace the person with the reference person.` README: stack with head v1.1,
  both at 0.5.
- The author (HF discussion #28) trained head v1.1 starting FROM Conrad's Krea2 identity-edit
  model, and the workflow loads BFS ALONE on `krea2_turbo`. Stacking our shipped
  `krea2_identity_edit_v1_2_r128` on top is untested and may double-dose: A/B it.
- Same node pair brief.md documents: `Krea2EditModelPatch` + two `Krea2EditGroundedEncode`.

## Items

- [ ] 1 - Run the author's Krea 2 head swap workflow as shipped; record the baseline.
- [ ] 2 - A/B: BFS head v1.1 alone vs stacked with `krea2_identity_edit_v1_2_r128`.
- [ ] 3 - Body swap v1 alone vs body + head at 0.5 / 0.5.
- [ ] 4 - Compare against brief.md's no-rig path (identity-edit weights, prompt only) and the
      shipped Head Swap Flow (Qwen).
- [ ] 5 - Decide which swaps earn a Flow; each winner becomes its own card.
