# MPI-1036 Validation

## Phase 1 - hidden instructions on the bench

Fabio approved the eight bench runs on 2026-10-08 ("very good results, I'm happy"); verdict and
numbers in `brief.md` § Fabio's verdict.

## Phase 2 - mask path on the bench

Passed on Fabio's eye test, 2026-10-08: the still square box (SAM3 -> `MpiMaskSquareBbox` pad 64)
with the akatz-ai swap LoRA, on horns and on remove; also the plain box re-timed by `resync.py`.
Every shape-mask paste failed (ghosting); the plain box drifted out of sync.

Measured, reproduce with the session scratchpad scripts (`mask_bench.py NAME`, `lag.py NAME`,
`compare_mask.py OUT NAME=path ...`) against `D:/WORK/Images/Outputs/mpi1036/`:

- Sync, mean frames off in the fast part (frames 5-34), `python lag.py M3_horns M3l_horns`:
  plain box 2.27, box + swap LoRA 0.00 (remove: 2.57 -> 0.00).
- Time, bench log "Prompt executed": box + LoRA 185 s vs whole frame 422 s (sampling 12.3 vs
  44 s/step) on a 576x1024, 73-frame clip.
- Drift inside the box vs source (`compare_mask.py`): plain box 5.09/255, box + LoRA 2.97/255.

Side-by-sides sent to Fabio: `box_horns_side_by_side.webm`, `box_remove_side_by_side.webm`,
`labelled_horns_side_by_side.webm` (session scratchpad).

## Phase 3 - Flow wiring (Video edit 8, 2026-10-08)

- raw/ -> API sync: `node scripts/sync-raw-workflows.mjs` validator green; `comfy_workflows/flow_video_edit.json` diffed against `research/bench/flow_graph.py` node by node (class, title, every input, every link): 73/73, 0 diffs.
- `node --test tests/agent-flow-handover.test.cjs tests/agent-prompt-budget.test.cjs tests/connector-flow-dispatch.test.cjs tests/connector-agent-tools.test.cjs tests/inject-params-titles.test.cjs tests/workflow-media-slots.test.cjs`: 87/87.
- Full suite: one red left, `user-flows.test.cjs` (a shipped Flow as a package needs a `preview` file) - waits on the tile.

## Phase 3 - in-app runs (Video edit 11, 2026-10-08)

- A3_background (op 4 + bedroom picture) on app:isolated, dispatched by `research/bench/run_in_app.py`: 1019 s, card
  landed. app.log: `[flow-describe] Video Edit Input_Look described via comfy (ComfyUI qwen3vl-abliterated-clip),
  13692 ms` and `Input_Kept ... 6515 ms`. Sidecar `generationSettings.injectionParams` has Input_Look (the room) and
  Input_Kept (the woman, first frame); `flowInputs.injectionParams` has neither (Reuse re-describes). Contact sheet
  source / R4e / A3: A3 matches R4e. PASS.
- A2_swap_keep: Input_Look described (11521 ms), then `engine_dropped` at sampling step 6/8 when Fabio's live app quit
  and relaunched (19:40:10Z), killing the engine the isolated app borrowed. Not judged, not re-run.
