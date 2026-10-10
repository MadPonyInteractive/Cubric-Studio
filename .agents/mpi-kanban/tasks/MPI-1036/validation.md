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

## Video edit 14 (2026-10-09) - mask square cap, Faceswap LoRA

- Fabio's in-app masked "Head" runs failed: close-up crown left blonde (flowVideoEdit_004), dance clip box seam at the
  hips (flowVideoEdit_003). Measured (median |result - source|, scratchpad boxfind.py): both pasted squares = frame width
  (448 / 1072) - MpiMaskSquareBbox capped and cut the mask. Fix nodes 55/24; the new expression checked on MpiNodes'
  own safe_math (448/448/800 -> False, 300/448/800 -> True).
- T1 (his close-up, fixed graph): 576x1024 out = whole-frame fallback, crown fixed, follows the side turn (~3 frames
  early on the way back). Fabio: likeness much better than his masked run.
- Faceswap LoRA (UntMods, sha256 = HF lfs, no 'lora key not loaded'): T2 = T1 + it, Fabio: same likeness (screen
  recording). Clean 1088x1920 H3 dancer (gen_dancer.py, 435 s): D1 whole 430 s, D2 whole + Faceswap 422 s, D3 masked
  591 s (bench runs the pre-88816c8 grade), D4 masked + Faceswap 611 s; D3/D4 in sync through the side turn, crown
  clean. Fabio: D2 closer than D1; ship on both routes; D3 a lot worse than D2/D4.
- Shipped: ee27e3a58 (square cap -> whole frame + docs), 85515d7de (Faceswap on op 2, dep minimax-h3-faceswap-lora).
  Raw -> generated synced; generated wiring checked (25/145-149, turbo <- 148, refs prompt <- 149). All 51 bench
  presets build. Full suite: 2834 tests, 2832 pass, 0 fail.
- NOT yet: in-app run of the shipped graph with the Faceswap dep (app restart + dep check), push (master red on
  MPI-623's bdfc432fe, its fix 1973b7c60 in CI).
- Video edit 15, Cosmo routing (Fabio OK'd $0.10): new agentBench case `video-hair-to-video-edit` (a dragged video
  card + "Change her hair in this video to short pink curls."; Video Edit added to the bench catalogue, which predates
  it). `npm run agent:test -- --case video-hair-to-video-edit --runs 3`: 3/3 pass on DeepSeek-V4-Flash-0731, first
  generate = flowId video-edit with the clip as video1. `--bite` (Video Edit removed): fails as it must, falls back to
  minimax-h3-ref2va ref2v_ms. Spent $0.0243. tests/agent-bench.test.cjs 14/14.
- Video edit 15, in-app run #1 (00:47) never generated: APP_UNAVAILABLE 2 s after server READY, no window subscribed
  yet. overnight_inapp.py now waits for /connector/capabilities generationSubmit; re-queued 00:52.
- Video edit 15, in-app run #2 (lease 01:26-01:40, own app:isolated): E1 whole 472 s (576x1024), E2 "Head" masked 377 s
  (1088x1920 stitched), Project "MPI-1036 Video Edit in-app" flowVideoEdit_001/002. No download line in the isolated
  profile's app.log, models root free space unchanged (9.4 GB): the Faceswap dep resolved from G:. Describe reused on E2.
  lag_full.py vs source: E2 mean |lag| 0.12, fast 5-34 0.00 (D4 0.11 / 0.00). Side-by-side sent to Fabio:
  logs/mpi1036/VE15_inapp_head_swap_sbs.webm (picture | source | E1 | D2 | E2 | D4). My read: faces match D2/D4;
  E1 carries the picture's blue halter neckline onto the dress (D2 shows faint straps too), E2 masked keeps the dress.
- Fabio 2026-10-10 on the side-by-side: "Looks good". Halter leak on whole frame = known limit; Cosmo's guide
  (docs/agent/flows.md) now types "head" when the picture's clothes differ, video-edit.md records it. Agent-doc tests
  (corpus, prompt budget, connector tools, field constraints, recipe registry) 47/47.
- Video edit 15, Fabio's three asks (OK'd $0.15): agentBench gradeVideoEdit (first ok generate = video-edit, clip as
  video1, Input_Operation = op). Hair case tightened to op 5 (Swap the head would redraw the face); new
  video-coat-to-outfit (op 3, coat in positive), video-buns-keeps-face (op 5, buns in positive), video-person-from-picture
  (op 1, picture as image1). --runs 3: 12/12 pass, $0.0568. --bite: 4/4 fail for the named reason (beach -> op 4,
  old man's face -> op 2, no picture -> no image1, no Video Edit -> bare H3). $0.0215. Round total $0.0783.
- 2026-10-10 first Video Edit runs on RunPod (Fabio, dev app, Pod image v0.26.0-dev-cu130, RTX PRO 6000 Blackwell Server,
  EU-RO-1, 100 GB volume): Flow deps + H3 installed on the volume in ~2 min; run 1 (Swap the person) 4 min incl. loading
  H3 while stage-on-connect copied it to fast disk; run 2 (new description, encoder re-ran) 2 min. Describe on his
  Remote endpoint (gemma-4-26B-A4B-it, 1.4 s), reused on repeats.
