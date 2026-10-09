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

## Phase 3 - video-editing prompts, two graphs (Video edit 12, 2026-10-09)

- Bench (our graph, every template in MiniMax's video-editing format, in-graph describe): S3 performance capture 692 s
  PASS on my look vs R3f 971 s; S1 swap keeping the video's room (room DESCRIBED from frame 0) 781 s = R2p; S7 masked on
  our graph 531 s LOST the lock (lag_full mean |lag| 1.11, worst -6..5); S7s same prompt on the single pass 484 s LOCKED
  (mean |lag| 0.01, worst 0..1, = R1b). => masked = single pass, whole frame = ours (Fabio: two graphs, the app picks).
- `export_raw.py push` -> bench frontend loadApiJson/serialize (118 + 79 nodes) -> `pull` -> `node scripts/sync-raw-workflows.mjs`:
  raw committed 2f72ee04b, injection rules green on both. Synced API vs builder (scratchpad `diff_synced.py`): 118/118 and
  79/79 nodes, 0 diffs (class, title, every input and link).
- `node --test tests/flow-model-choice.test.cjs tests/inject-params-titles.test.cjs tests/smoke-flows.test.cjs
  tests/flow-describe.test.cjs tests/workflow-media-slots.test.cjs tests/user-flows.test.cjs tests/agent-flow-handover.test.cjs`:
  122/122. Full suite `node --test "tests/**/*.test.cjs"`: 2822 tests, 2820 pass, 0 fail, 2 skipped.

## Phase 3 - one graph, clip at 0.75 (Video edit 13, 2026-10-09)

- Bench, single pass + clip at 0.75 (sheets in session c646905a scratchpad, frames 5/24/40/62/82/110; lag_series.py):
  S6x outfit 671 s = R6d (face kept, lag +1/+2 throughout); S1x swap keeping the room 711 s >= R2p (frames 80-105 lag 0
  where R2p reads +-12); S3x picture + its room 691 s = R3f (971 s); S4x background 661 s = R4e (Video edit 12).
- Export: synced API vs builder (diff_synced.py) 81/81 nodes, 0 diffs; validate-injection-rules green; object_info check
  0 faults.
- node --test tests/flow-model-choice.test.cjs tests/inject-params-titles.test.cjs tests/flow-describe.test.cjs
  tests/workflow-media-slots.test.cjs tests/user-flows.test.cjs tests/agent-flow-handover.test.cjs tests/smoke-flows.test.cjs:
  121/121. Full suite node --test "tests/**/*.test.cjs": 2826 tests, 2824 pass, 0 fail, 2 skipped.
- NOT yet: Fabio's in-app eye test (the head swap on the new template 2 + R5e hair line + 0.75 is unbenched).
