# MPI-1063 - Video Edit Flow (umbrella)

Fabio, 2026-10-10: one umbrella for the Video Edit Flow so no card gets lost. New Video Edit work goes in
this plan or under it, never as a loose card. Sits under MPI-897 (Localised editing).

## Members

| Card | Title | State |
|---|---|---|
| MPI-1036 | Video Edit Flow on MiniMax H3 Reference - swap a person, head or outfit, or any edit, with an optional mask step | `doing` / `in-progress` |
| MPI-1061 | Video Edit: add LTX 2.3 as a second model option (bench LTX IC-LoRAs for clothes / character swaps) | `todo` / `research` |

Related, NOT members: MPI-745 (LTX 2.3 BFS head swap IC-LoRA - solo by Fabio 2026-09-14; its LoRA may become the
LTX route for Swap the head), MPI-477 (H3 pixel-space refiner - the 2K/4K stage-2 question), MPI-557 (video
detailer, its own Flow).

## Current State

- MPI-1036: H3 Flow wired and shipped behind the H3 gate; open = the room / 1080p bench (Canny reference and the
  H3 Fun ControlNet Union A/B), Fabio's eye on the compare-view fix, Phase 4 graphics. Its plan.md Current State
  is the running log.
- MPI-1061: unstarted. Handed to MPI-1036's session by MPI-1060's (2026-10-10). Fabio: H3 STAYS, LTX 2.3 is ADDED
  as a separate model option in the same Flow because LTX's quality is higher.

## Phase 1 - H3 path closes (MPI-1036)

**Verify:** MPI-1036's own validation.md; Fabio approves the tile and hero.

## Phase 2 - LTX 2.3 bench (MPI-1061)

**Verify:** Fabio judges LTX against the H3 outputs on the SAME presets (MPI-1036 `research/bench/run_flow.py`
V4* bedroom / V6* shower, inputs `G:/ComfyUi/ComfyUI/input/mpi1036_room_*`, H3 outputs
`D:/WORK/Images/Outputs/mpi1036/`).

Candidates (MPI-1061 task.json): (1) In-Outpainting IC-LoRA + a SAM3 mask
(`ComfyUI-LTXVideo/example_workflows/2.3/LTX-2.3_ICLoRA_Inpaint_Two_Stage_Distilled.json`); (2) Union Control
pose/depth/canny from the source (`C:/AI/loras/LTX2.3/ltx-2.3-22b-ic-lora-union-control-ref0.5.safetensors`,
`LTX-2.3_ICLoRA_Union_Control_Distilled.json`); (3) Union Control + an Ingredients sheet stacked = character swap
(untested). Ingredients ALONE cannot edit: a real clip fed as its guide is COPIED (MPI-1060 research/results.md).
Graph builder to copy: `tasks/MPI-1060/research/bench-tools/ingredients_run.py`. A sheet for the new look reuses
MPI-1060's `ref2v_ms` path in `comfy_workflows/raw/ltx_i2v_t2v_template.json`, never a second one.

## Parallel Batch - benches (Phases 1 and 2)

Both benches share the G: bench GPU: every run under `gpu_lease.py` (FIFO), never two renders at once.

- MPI-1036 - Ownership: `.agents/mpi-kanban/tasks/MPI-1036/`, `js/data/flowsRegistry.js` (video-edit only),
  `comfy_workflows/flow_video_edit.json`, `comfy_workflows/raw/flow_video_edit.json`,
  `docs/playbooks/add-flow/existing-flows/video-edit.md`. **Verify:** its validation.md.
- MPI-1061 - Ownership: `.agents/mpi-kanban/tasks/MPI-1061/` only (bench research; no app file).
  **Verify:** a side-by-side per candidate vs the H3 output, Fabio's verdict in its validation.md.

## Phase 3 - LTX 2.3 as a model choice in Video Edit (only if Phase 2 wins)

**Verify:** the `/mpi-add-flow` checks for a second model on one Flow, then Fabio runs each option in the app.
Touches MPI-1036's files, so it runs after Phase 1 or in the same session. LTX workflows land as Flows, never ops.

## Remaining Work

- [ ] Phase 1 - MPI-1036 closes
- [ ] Phase 2 - MPI-1061 bench + Fabio's verdict
- [ ] Phase 3 - LTX option wired (if Phase 2 wins)
- [ ] Fabio decides whether the member cards close into this umbrella

## Plan Drift
