# MPI-1036 - plan

`brief.md` carries the decisions and the numbers; this is the running plan.

**Verify mode:** user-ux

Verification is Fabio's eyes on edited clips, plus measured timings for the mask path.

## Current State

2026-10-07: card in `doing`, Phase 1 bench ready; waiting on Fabio's runs.

- `G:/CubricModels/loras/minimax-h3/h3_character_swap_pro4500_1000.safetensors` - 155,110,320 B,
  sha256 `4b2a3f42...` matches the repo's `SHA256SUMS`.
- `G:/ComfyUi/ComfyUI/user/default/workflows/H3 Character Swap v1 Ref2VA.json` - akatz-ai's
  example, repointed at the weights we ship: text encoder #128 -> the heretic int8_convrot
  (theirs was nvfp4_awq, reverted by MPI-698 and not on the bench); turbo #145 -> our 8-step v1.0
  (theirs 4-step v0.1), so #144 "Int (Lightning LoRA)" 4 -> 8; swap LoRA #147 -> the `minimax-h3\`
  subfolder. 32 nodes, 35 links, 0 dangling. Turbo off by default (their switch #146).
- A/B: bypass #147 (Ctrl+B) for the base run; same seed (#129 fixed 904234), 4-5 s clip.

2026-10-07 evening: Phase 1 runs C, D, A, E, F, F_depth, F_lineart, G done on the bench (results +
timings in `brief.md`; outputs `D:/WORK/Images/Outputs/mpi1036/`, the bench saves there via
`--output-directory`; inputs `G:/ComfyUi/ComfyUI/input/mpi1036_*`; API builders in the session
scratchpad `charswap_*.py`). Proven: the swap LoRA helps a little (background + overlay kept);
a back view of the character is used; the performance-capture mode (F, raw clip, recipe-shaped
prompt) gives the picture's quality, not the clip's; background-only change (G) works.

2026-10-08: Fabio approved the bench results ("very good, I'm happy") - verdict in `brief.md`.
Wan Animate is no longer a comparison target (MPI-289 rejected).

2026-10-08 (Video edit 6): Phase 2 started on Fabio's pick. Clip: last 3 s of
`C:/Users/Fabio/Videos/Screen Recordings/new (3).mp4` (medium shot -> close-up), staged as
`G:/ComfyUi/ComfyUI/input/mpi1036_ears_last3s_24fps.mp4` (73 frames = 17k+5 at 24 fps, 576x1024,
sound). Edit: cat ears -> small demon horns, and remove them. Builder: session scratchpad
`mask_bench.py` (SAM3_Detect "cat ears" on `sam3.1_multiplex_fp16` -> InpaintCropImproved
512x512, expand 12, blend 16, context 1.6 -> H3 turbo 8-step -> InpaintStitchImproved, source
audio muxed). Mask + crop preview: both ears held in every frame, 75 s incl. SAM3 load.
Runs M_horns, M_remove (masked) and U_horns (whole frame, timing baseline) queued.
Then M2 (mask +32 px + ComposeColorMatch grade match), M3/M4 (Fabio's still square, padding
64/128, + grade match). All results + timings in `brief.md` § Phase 2. Side-by-sides sent to Fabio
(scratchpad `horns_side_by_side.webm`, `remove_side_by_side.webm`, built by `compare_mask.py`).
Fabio's eye test: shape-mask pastes FAIL (ghosting), the box drifted out of sync -> shape masking
dropped. Then the box + swap LoRA (M3l) locked sync (lag 0.00, no edge seam) on horns AND remove;
the camera line and re-sync add nothing on top. Videos `box_horns_side_by_side.webm`,
`box_remove_side_by_side.webm`. Fabio PASSED it (and the plain box re-timed by `resync.py`):
Phase 2 closed, recipe in `brief.md` § Phase 2 recipe, evidence in `validation.md`.

Fabio decided: the mask step is a TEXT field resolved by SAM3 in-graph, box round it - MPI-715 is
NOT a dependency. Next action: Phase 3 - wire the Flow with `/mpi-add-flow`. New parts it needs:
the swap LoRA as a dep, a shipped grade-match node (see `brief.md` § Phase 3 parts check).
Masked mode drops the hidden "no text" line. Also decided 2026-10-08 (`brief.md` § Decided):
video head swap is free once tested; clothing removal stays (own dropdown entry if it needs its
own wording, e.g. a supplied torso image).

2026-10-08 (Video edit 7): Phase 3 started.
- Grade match = NEW MpiNodes node `MpiGradeMatch` (`grade.py`, torch only, `tests/test_grade.py` 5 pass),
  committed + pushed `6bf5659e689d78496d00452abd1d87206c5a26f5`. KJNodes ColorMatch rejected (whole-frame
  palette, no mask - tints the edit); MpiInpaintHeal rejected (shifts a fill's mean to its surroundings, no
  paired original). A/B vs ComposeColorMatch on the passed M3l_horns crop (`grade_ab.py`): 0.93/255 mean,
  below the 1.07/255 codec-noise floor, diff map = edge codec noise only.
- PIN NOT MOVED: `dev_configs/node_lock.json` is claimed by the MPI-1043 engine-bump session (0437ad9a);
  message `8e322db4` asks it to take MpiNodes to 6bf5659 in its bump (Fabio: next release may carry an
  engine bump). Until pinned, the app engine has no MpiGradeMatch - in-app runs need the pin.
- Swap LoRA dep `minimax-h3-character-swap-lora` in `loraDeps.js` (HF url, sha256 4b2a3f42...e79 = HF LFS
  oid); `licences.js` `'flow:video-edit': MINIMAX_H3`. Flow id = `video-edit`. SAM3 is an engineAsset, no dep.
- Bench builders saved to `research/bench/` (charswap_*.py = Phase 1 prompts, mask_bench.py etc.).
- THE FLOW GRAPH = `research/bench/flow_graph.py` (API prompt with the real Input_*/Output_* titles; the
  authoring source). Runner `run_flow.py <preset>` (presets R1-R5), sync check `lag_full.py SRC RUN...`
  (box found at diff > 8/255; validated: M3 2.13, M3l 0.00). Single-pass H3 r2v turbo 8 (bench shape, NOT the
  shipped two-pass r2va), MpiH3References, swap LoRA via MpiIfElse, 12 instruction templates (6 picture / 6 no
  picture, picked by MpiMath + MpiAnySwitch10), {who}/{target}/{words} by StringReplace, masked vs whole
  routed in-graph (masked = Input_Target typed AND op != 4). Inputs: Input_Video, Input_Image, Input_Positive,
  Input_Operation (1 person, 2 head, 3 outfit, 4 background, 5 anything; 6 = person into the picture's room,
  picked in-graph), Input_Keep_Background, Input_Who, Input_Target, Input_Seed. Output_Video, source audio.
- R1 (masked, op 5, "cat ears" -> horns) PASSED the numbers: in sync (fast frames 0.00), edge drift 3.22 vs
  M3l's 2.97/255, horns made, ears gone. 470 s cold. BUT the caption inside the box is re-drawn GARBLED
  (masked tail drops "no text" per Fabio's decision; the M3l pass had it and erased the caption cleanly).
  Fabio's call - asked in the Video edit 7 close-out; pick = keep "no text" in masked mode too.
- R2-R5 (whole frame: swap keep room, swap picture room, background, head) NOT RUN - stopped for Fabio's
  engine bump (bench + app). Re-run them after the bump: `run_flow.py R2_swap_keep R3_swap_picture_room
  R4_background R5_head` under the GPU lease, in the background (~10-16 min each).
- App side wired so far (uncommitted until the handoff): op `flowVideoEdit` in the 4 registries
  (appVersionIntroduced 2.0.1, same as MPI-623's scene ops), `ENHANCE_EXEMPT_OPS` + flowVideoEdit
  (tests/enhance-control requires any *edit* op there). NOT yet: FlowDef, the workflow file
  `comfy_workflows/flow_video_edit.json` + `raw/` twin, inject test case, agent docs, UNRELEASED.md.
- FlowDef plan: id `video-edit`, title Video Edit, type edit, mediaType video, requiredModels
  ['minimax-h3-ref2va'], requiredDeps ['minimax-h3-character-swap-lora'], media video1 + optional image1,
  result.compare video1; fields: Input_Operation select 1-5, Input_Keep_Background radio (hiddenWhen op isNot
  1), Input_Who text default 'the person' (hiddenWhen op is 5), Input_Target text "Only change (optional)"
  with the faster/keeps-the-rest hint (hiddenWhen op is 4), positive text. Seed is injected by
  commandExecutor (Input_Seed). No preview yet (Phase 4).
- raw/ export route: no API->LiteGraph converter exists. Load the flow_graph.py prompt into the bench
  frontend (app.loadApiJson), check titles survived, `app.graph.serialize()` -> `comfy_workflows/raw/
  flow_video_edit.json`, then `node scripts/sync-raw-workflows.mjs` (needs a running ComfyUI) - it resets
  the pickers to None and gates on validate-injection-rules.
- In-app runs need the MpiNodes pin at 6bf5659 (message 8e322db4 to the MPI-1043 bump session).

2026-10-08 (Video edit 8): engine bump landed (MPI-1043 04b4f08eb, bench on 0.39.0, MpiGradeMatch registers).
- R2-R5 running on the bench under the lease (background, log in the session scratchpad `r2r5.log`).
- FlowDef `video-edit` in `flowsRegistry.js` (after ltx-upscale), no `preview`/`video` yet. Fields as planned;
  description ends on the long-clip warning.
- BUG FOUND + FIXED in the graph: Input_Who / Input_Target were `MpiString`, which the app treats as a media
  PATH (`comfyController` PATH_MEDIA_CLASSES -> staged as a file). Now `MpiText`. Caught by
  `tests/workflow-media-slots.test.cjs` (MpiAnyChecker on an Input_* MpiString).
- raw/ exported via the bench frontend (`research/bench/export_raw.py push|pull` + browser `loadApiJson` /
  `serialize`), synced: raw committed `15b26e6ea` + `0bf61b010` (sync script commits raw itself), API
  `comfy_workflows/flow_video_edit.json` STAGED, diffed against the builder: 73/73 nodes, 0 diffs.
- Tests: inject-params-titles case, agent-flow-handover `runs` += video-edit. Full suite 2777/2780 before the
  last fixes; the one left: `user-flows.test.cjs` "every shipped Flow, expressed as a package" needs a
  `preview` file - RED UNTIL PHASE 4 ART (or a provisional tile). Do not push the FlowDef without it.
- Docs: `docs/agent/flows.md` § Video Edit, `docs/playbooks/add-flow/existing-flows/video-edit.md`.
- NOT yet: UNRELEASED.md (claimed by the live MPI-1043 session cd4bd605; no `## What's new` section exists -
  add one with the Flows roster + entry at close), in-app runs, Fabio's eye test, Phase 4.
- Fabio (same session): YES to keeping "no text" in masked mode (done: TAIL_MASKED = change-only line +
  TAIL_WHOLE, raw re-exported + synced, 0 diffs), YES to a provisional tile (done:
  `comfy_workflows/display/flow-video-edit.webp`, frame 30 of Phase 1 run F, 896x1120 - NOT the horns or dance
  clips: those are a real TikTok creator's footage with her @handle, never ship them; Phase 4's hero needs owned
  footage), YES to in-app runs on app:isolated (his GPU, 48188 shared).
- Full unit suite green (2778 pass, 0 fail) with the tile.
- **R2 (swap, keep room) FAILED the swap** (brief.md § Phase 3): the dancer keeps her own face/hair/clothes, only
  the picture's accessories came over. Run E (Phase 1) swapped fully with a prompt that named the look and said
  "no blonde hair remains". Next: test a generic line in PHOTO[1] (and NO_PHOTO[1]) - "nothing of {who}'s own
  face, hair or clothes remains" - as R2b; if it holds, re-export raw + sync.
- In flight at handoff: `run_flow.py R3 R4 R5` (lease, log scratchpad `r2r5.log` of session f014ce69) and the
  queued R1 re-run (no-text masked tail, `r1b.log`). Outputs land in `D:/WORK/Images/Outputs/mpi1036/` as
  `R3_swap_picture_room_*`, `R4_background_*`, `R5_head_*`, `R1_masked_horns_00002.mp4` whatever happens to
  this session - judge them from there. Contact sheet recipe: ffmpeg scale both to 225x400, select frames
  12/48/90, tile=3x1, vstack (source 480x864, output 576x1024).
- In-app runs: `research/bench/run_in_app.py <base-url> A1_masked_horns A2_swap_keep`, wrapped in gpu_lease,
  after the bench is idle AND its VRAM freed (POST :8188/free {"unload_models":true,"free_memory":true}).
  Launch: `APP_DOCUMENTS=<scratch> npm run app:isolated` in the background, grep READY for the port;
  `git status -- dev_configs/` must be clean first (boot repairs the real engine to the pin).

2026-10-08 (Video edit 9):
- R3 (swap into the picture's room) FAILED the same way as R2: room + cat ears came over, the dancer kept her own
  look. Verdict + the run-F prompt comparison in `brief.md` § Phase 3. Common cause = no look line in templates.
- R4 (background) FAILED too: source room unchanged. Phase 1 G named the room; template 4 does not. Pattern for
  R2/R3/R4: a picture the prompt does not describe is mostly ignored (`brief.md` § Phase 3).
- `GONE` ("Nothing remains of how {who} looked: not their face, their hair or their clothes.") added to PHOTO[1],
  PHOTO[6], NO_PHOTO[1] in `flow_graph.py` (NOT yet re-exported to raw/ + synced). Presets `R2b_swap_keep` (GONE
  only), `R2c_swap_keep_named` (+ look in words), `R4c_background_named` (room in words) queued under the lease
  (log: session d8900127 scratchpad `r2b.log`). `R3b_swap_picture_room` defined, not queued.
- If only the named runs work, the fix is a description of the picture, and WHERE it comes from is Fabio's call:
  the user's words (field hint), the agent, or an in-graph caption (H3's encoder cannot generate; another VLM).
- In-graph caption BUILT behind `graph(caption=True)` (default off, default graphs byte-identical to before):
  the shipped image-describer encoder (`qwen3vl-abliterated-clip`, 4.88 GB, shared with Krea2) + core TextGenerate,
  a per-template ask (person / head / outfit / place / subject / person + place), spliced as `{look}` after the
  template; lazy MpiIfElse so no picture = no load. PreviewAny node 163 is BENCH ONLY - drop before export.
  Presets `R2d_swap_keep_described`, `R4d_background_described` queued (log `r2d.log`). Shipping it adds
  `qwen3vl-abliterated-clip` to the FlowDef's requiredDeps - Fabio's call with the evidence.
- **R2d PASSED (full swap, 941 s)** - verdict + the description text in `brief.md`. Side-by-side source | R2 | R2d sent
  to Fabio (session d8900127 scratchpad `r2_vs_r2d_side_by_side.webm` - NEVER into the repo: creator footage).
  RegexReplace node 164 trims the describer's leading ": ". R2b/R2c/R4c dropped (never ran). R4d running;
  `R3d_swap_picture_room_described` + `R5d_head_described` queued (log `r2b.log`, reused name).
- R4d: room right, but the picture's PERSON leaked onto the dancer. Built `{kept}` = second describer pass on the
  clip's first frame (op 4 + picture only); preset `R4e_background_kept`. PreviewAny 163 now shows the whole
  prompt sent (runner prints `PROMPT SENT =`).
- GPU etiquette: MPI-936 (Qwen 2.1 session) asked for the next turn; I stopped my R3d/R5d waiter and promised not
  to queue until MPI-936 holds the lease. Then queue `R3d_swap_picture_room_described R5d_head_described
  R4e_background_kept`. The old R1b waiter (pid 30048, session f014ce69) is still in the race - killing it was
  refused (another session's process).
- R1b (masked, "no text" kept) PASSED: caption in the box erased cleanly, horns made, sync 0.00 on fast frames.
  The masked path needs nothing more on the bench.
- R4e, R3d, R5d queued at 16:55 behind MPI-936 (log session d8900127 scratchpad `r3d.log`).
- **R4e PASSED** (dancer kept, bedroom right) - side-by-side sent. Open question for R5d: does the head swap leak the
  picture's body/clothes too? If yes, extend `{kept}` (the clip's person) to templates 2 and 3 (`170`'s expression).
- R3d: swap + room right, but ~0.8 s opening on the picture's own pose. Template 6 now "from the first frame ...
  Never show <Picture 1> itself or hold its pose" (changes the non-caption R3 graph too - expected). R3e queued
  (log `r3e.log`).
- R5d: face + bun from the picture, source's blonde lengths still under it; no body leak (`{kept}` not needed for 2).
  Template 2 now says all of their own hair goes; R5e queued (log `r5e.log`). Fallback: swap LoRA on for op 2.
- **R5e PASSED** (full head swap). R3e = no change vs R3d (opening hold is the mirror picture, not the wording).
  Queued: R3f (picture room, front-facing cat-girl picture, `r3f.log`), R6d (outfit, described, `r6d.log`).
  Side-by-sides sent to Fabio: R2/R2d, R4/R4e, R5/R5e (scratchpad, never the repo).
- Score so far with caption=True: person (R2d), head (R5e), background (R4e), masked (R1b) PASS; picture room (R3d/e)
  passes after a ~0.8 s opening hold on this mirror picture; outfit (R6d) pending. Untested: op 5 whole frame,
  every no-picture template.
- **FABIO DECIDED (late Video edit 9): the description follows Remote > Language Models > Image descriptions**, NOT an
  in-graph describer. So the shipped graph gets NO describer nodes: it gets two hidden MpiText inputs (e.g.
  `Input_Look`, `Input_Kept`) spliced where `{look}` / `{kept}` sit, and the app fills them BEFORE the run through
  `llmService.describeImage()` (the gallery's switch point; comfy branch = image_descriptor.json, Qwen3-VL-4B).
  Asks per template = `CAPTION_ASK` in flow_graph.py; `{kept}` = the clip's FIRST FRAME described with
  `CAPTION_ASK[1]`, only for op 4 + picture. Must run for hand runs (MpiBaseFlow) AND agent/routine runs
  (`agentDispatch.buildFlow`) - model it on `services/flowEnhance.js` (the shared enhance leg, MPI-1002). Needs a
  first-frame image from the clip app-side. Keep the RegexReplace-style trim of a leading ": " app-side.
- Qwen3-VL-4B becomes an app dependency installed with ComfyUI (MPI-1045, created this session, todo/research:
  deprecate the Image Describer plugin; must land before Video Edit ships). So Video Edit adds no describer dep.
- Tile: Fabio wants >= 3 images like Character Sheet / Object Stamp (Phase 4), from owned footage.
- IN FLIGHT at handoff (background lease waiters of session d8900127; outputs land in
  `D:/WORK/Images/Outputs/mpi1036/` whatever happens to that session): `R3f_swap_picture_room_front_00001.mp4`
  (template 6 with the front-facing cat-girl picture: does an ordinary picture open clean?) and
  `R6d_outfit_described_00001.mp4` (template 3, never benched). Judge both against the source + picture.
- `flow_graph.py` templates changed this session (GONE in 1/6/no-picture 1, hair line in 2, "from the first frame /
  never show <Picture 1>" in 6, LOOK/{kept} lines, caption block). NOT re-exported to raw/ - do that once the
  app-side describe inputs replace the caption block.
- If R3d/R4e/R5d hold: make caption=True the graph (drop PreviewAny 163), add the dep to the FlowDef, re-export
  raw/ + sync (constraint list in the handoff), docs (`existing-flows/video-edit.md`, `docs/agent/flows.md`).
- UNRELEASED.md is free now (no peer claim) but its Video Edit bullet waits for Fabio's eye test.

2026-10-08 (Video edit 10):
- **R3f PASSED** (front-facing bedroom cat-girl picture, template 6): opens clean on frame 0, full swap + room. The
  R3d/R3e hold is the mirror shot's back-to-camera pose, not the wording (`brief.md` § Phase 3).
- R6d (outfit, described) still waiting for the lease (waiter pid 40168 of session d8900127, log its scratchpad
  `r6d.log`; MPI-1042 then MPI-936 took the GPU first). Lands in `D:/WORK/Images/Outputs/mpi1036/` regardless.
- App-side describe design (briefed to Fabio, awaiting his go):
  - Graph: caption block (140-173, PreviewAny 163) out; two MpiText inputs `Input_Look` / `Input_Kept` (default '')
    replace `{look}` / `{kept}` by StringReplace. LOOK lines stay in the picture templates.
  - FlowDef `describe: [...]` (new key; `services/userFlows.js` FLOW_KEYS += 'describe'): entries
    `{ to, media, when, ask, frame? }`, first entry per `to` whose `when` rules match (hiddenWhen's `{field, is|isNot}`)
    and whose media role is present runs. Look: 6 entries (op 1 + keep false = person+place, then op 1..5). Kept:
    op 4, media video1 frame 0, needs image1, ask = PERSON.
  - Runner `describeFlowRun(flow, config, deps)` in `services/flowEnhance.js`, called ONCE in
    `flowService.submitFlowGeneration` before enqueue (the runCloudEdit precedent: async, returns
    `{queueJobId: null, tempId}`) - covers hand, agent and routine runs without touching MpiBaseFlow or
    agentDispatch (MPI-1045 holds agentDispatch.js + llmService.js; we only CALL describeImage). Writes only blank
    targets into run-only `injectionParams`, never the snapshot (Reuse re-describes). Trims a leading non-word run.
    Failure/cancel stops the run with the describer's error + "Remote > Language Models" (enhance's rule).
  - Clip first frame: renderer `<video>` -> `captureFrameBlob` (utils/video.js) -> `place-preview-asset`
    (content-addressed, no card) -> describeImage. Project = `runOriginProject || state.currentProject`.
  - Test: `tests/flow-describe.test.cjs` (ask per op/keep/picture, Kept only op 4 + picture, blank-only, trim,
    failure stops) with describe + frame grab stubbed. Then raw/ re-export + sync, in-app runs on app:isolated.
- Fabio: GO, description stays HIDDEN. BUILT (uncommitted): `flowEnhance.js` describeAsks/describeFlowRun,
  `utils/video.js` firstFrameDataUrl, `flowService.submitFlowGeneration` hook, `services/userFlows.js` FLOW_KEYS
  'describe', `tests/flow-describe.test.cjs` (8/9 pass with the FlowDef preloaded; the 9th needs the synced API),
  docs (video-edit.md, 01-descriptor-and-ops.md, agent/flows.md). `flow_graph.py`: Input_Look/Input_Kept (18/19) +
  {look}/{kept} always; caption=True still the bench describer (R6d's graph unchanged). raw/ RE-EXPORTED (77 nodes,
  converted API = builder, 0 diffs, validator clean) but NOT synced/committed.
- BLOCKED on two peers: (1) `js/data/flowsRegistry.js` is in MPI-1045's claim (session 9ac7a7c7) - message
  `4a34f6a0` asks for release or "go"; the hunk to paste is in session 188faecd scratchpad `flowdef_describe.js`
  (also `preload_describe.mjs` = the same block for running the test before it lands). (2) the sync refuses while
  MPI-936's `comfy_workflows/qwen_image_2_1.json` is staged - re-run `node scripts/sync-raw-workflows.mjs` once it
  is committed (it commits raw itself, stages the API).
- (2) CLEARED: synced - raw committed locally `2ff4c0ff4` (not pushed), API `comfy_workflows/flow_video_edit.json`
  STAGED, byte-equal to the builder-checked conversion. flow-describe 9/9 with the FlowDef preloaded.
- (1) CLEARED on Fabio's word ("just add the registry hunk"): path lent out of MPI-1045's claim, hunk added, given
  back; MPI-1045 then committed `5938f6484` (describer = engineAsset, Image Describer plugin + DESCRIBER_MISSING
  gone) and released. Full unit suite 2789 pass / 0 fail, eslint clean on the touched files.
- In-app: `app:isolated` up on :64232 (APP_DOCUMENTS = session 188faecd scratchpad `appdocs`, profile
  `cubric-agent-profile`), attached to Fabio's engine on 48188. `run_in_app.py A3_background A2_swap_keep` queued
  under the lease (log scratchpad `inapp.log`); A3 (new preset) = op 4 + bedroom picture -> Look + Kept (first frame).
  Evidence = each card's sidecar `Media/.meta/<id>.json` (injectionParams Input_Look/Input_Kept) + the clip.
- **R6d PASSED (Fabio)**: outfit exact; the bare legs are the picture's own ("she never had any bottoms"). Template 3
  stays. Bench score: person, head, outfit, background, picture room (front picture), masked all PASS.
- IN FLIGHT at handoff: the in-app lease waiter (session 188faecd background, `inapp.sh` -> frees :8188 VRAM, then
  `run_in_app.py http://127.0.0.1:64232 A3_background A2_swap_keep`, log scratchpad `inapp.log`). The project lands
  under scratchpad `appdocs/`. If :64232 is dead when the lease comes, relaunch app:isolated (new port) and re-run.
  Judge: sidecar Input_Look/Input_Kept non-empty and sane, clip like bench R4e / R2d; app.log `[flow-describe]` lines.
  Then close the isolated app (memory: close via the listener's PARENT), then UNRELEASED.md bullet after Fabio's eye
  test, then Phase 4 graphics (>= 3 images, owned footage).

## Phase 1 - The hidden instructions, on the bench

**Verify:** Fabio judges each option on 2-3 real clips; the winning instruction text for every
option x {photo, no photo} is written into `brief.md`.

Bench copy of `comfy_workflows/minimax_h3_r2va.json`: the clip as `<Video 1>`, the photo as
`<Picture 1>`. Draft the four options' instructions, two variants each, each ending in "keep
everything else the same". Today's drift (half-applied recolour, a changed dress cut) is the
bar to beat.

Swap the person also gets an A/B on the akatz-ai Character Swap LoRA (`brief.md`): same
clip, seed and 4-5 s shot, base vs +LoRA, each with turbo on and off. Background held and
identity taken from the photo are what it is judged on. Repeat on Swap the head to see
whether the LoRA helps or fights it.

## Phase 2 - The mask path, on the bench

**Verify:** a small-region edit stitched back into the untouched source at source resolution,
and its time against the same edit unmasked.

SAM3 mask in-graph for now -> `InpaintCropImproved` -> H3 -> `InpaintStitchImproved`, as the
Bernini bench did (MPI-711). Mask frame count and rate must match the source, or the stitch
refuses. Grow / fill holes stay upstream in the mask step, never in this graph (MPI-711 decision).

## Phase 3 - Wire the Flow

**Verify:** the `/mpi-add-flow` playbook's own checks, then Fabio runs each option in the app.

Run `/mpi-add-flow`. Fields: clip, optional photo, the picker, the user's extra words, an
optional "what to change" TEXT field - filled = masked mode (SAM3 -> square box pad 64 -> H3 +
swap LoRA -> grade match -> stitch, with a hint that it is faster and keeps the rest as filmed),
empty = whole-frame edit. (MPI-715 dropped as a dependency, Fabio 2026-10-08.) Behind the H3
licence gate. Long-clip warning, no cap.

## Phase 4 - Flow graphics

**Verify:** Fabio approves the tile and hero.

Run `/mpi-flow-graphics`.

## Remaining Work

- [x] Phase 1 - hidden instructions benched (Fabio approved 2026-10-08)
- [x] Phase 2 - mask path benched and timed (square box + swap LoRA, Fabio passed 2026-10-08)
- [ ] Phase 3 - Flow wired
- [ ] Phase 4 - graphics

## Completed

## Plan Drift

- 2026-10-08: the talking/acting-clip test through mode F is DROPPED - Fabio: the Phase 1 dance
  runs already carried the face, expressions, mouthing the song in sync and the right audio, at
  a distance from the camera, so performance capture's face/lip-sync question is answered.
- 2026-10-08: Phase 2's shape-mask paste (the plan's InpaintCrop/Stitch round the SAM3 mask) FAILED
  on Fabio's eye (ghosting); the still square box + swap LoRA replaced it. The swap LoRA is no
  longer swap-only: it locks H3's timing to the source for every masked edit.
