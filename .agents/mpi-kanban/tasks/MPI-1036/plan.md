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

2026-10-08 (Video edit 11):
- The old waiter never ran: `gpu_lease.py run -- bash ...` from Windows Python resolves `bash` to WSL's
  (`execvpe(/bin/bash) failed`). Re-queued with `"C:/Program Files/Git/bin/bash.exe"`.
- **A3_background PASSED in-app** (1019 s): `[flow-describe]` Look 13.7 s + Kept 6.5 s via ComfyUI Qwen3-VL;
  sidecar `injectionParams` carry both, `flowInputs` (the Reuse snapshot) carries neither, as designed. Clip ~=
  bench R4e (same room, woman, outfit, in sync, caption gone) - sheet `sheet_a3.png` in this session's scratchpad.
- **A2_swap_keep NOT JUDGED**: its Look described fine (11.5 s), then `engine_dropped` at sampling step 6/8 -
  Fabio's live app quit + relaunched at 19:40:10Z ("Remote Pod teardown on quit"), taking down engine 48188 the
  isolated app borrowed. Not a Flow fault; graph is the bench's (API = builder, 0 diffs), R2d passed there.
  Not re-run: 17 min on Fabio's engine; his eye test runs the same path.
- Isolated app closed (parent 40372). Next: Fabio's in-app eye test, then UNRELEASED.md, then Phase 4 graphics.
- **Fabio: try the Flow on OUR shipped H3 graph** (two-stage turbo, refs `match` stage 1 / `max` stage 2, upscaler,
  same math), swap LoRA added; "the results decide which graph we go with". Builder `research/bench/flow_graph_ours.py`
  = `minimax_h3_r2va.json` as-is (Input_is_Turbo on) + swap LoRA (IfElse on node 21, ahead of Input_Lora_1) + the
  Flow's inputs/instruction/describer/source-audio tail; 141 nodes, validated against bench object_info. Preset
  `R2o_swap_keep_ours` = R2d's inputs + seed. R2d baseline (bench log `G:/ComfyUi/ComfyUI/user/comfyui.log`): 15:38
  total, 8 steps x ~105 s. R2o queued under the lease (this session's scratchpad `r2o.sh` / `r2o.log`). Then: side-by-side
  `sbs.py` (source | R2d | R2o, timing in the labels) + per-stage times from the bench log -> Fabio picks the graph.
- **R2o RAN: 12:21 vs R2d 15:38.** Bench log split: describe + both refs encodes ~3:00 (the 25 GB H3 TE runs twice, once
  per refs node; started cold), stage 1 10 x 32 s = 5:21 (288x512), upscaler 15 s, stage 2 3 x 69 s = 3:28 (576x1024;
  EasyCache skipped 0/3), decode 16 s. Sampling 8:49 vs 14:02. LOOK: sharper, truer character, follows the turn on time
  (R2d lags ~0.3 s there) - BUT the room is LOST: the picture's bathroom/mirror replaced the clip's living room (R2d kept
  it). Which stage drops it is unknown (stage-1 preview not saved on the bench). Sent `swap_one_vs_two_stage.webm` +
  `sync_strip.jpg` (scratchpad). Waiting on Fabio's pick.
- Fabio: KEEP `max` on stage 2 (the point of two stages: max only where it refines); no edit skill exists on record
  (MiniMax's repo `skills/` are genre generators; Higgsfield LIRA's CHANGE/PRESERVE is image-edit, Seedance) -> use the
  H3 prompt guide, POSITIVE only. Finding: the vendor `ref-en.txt` (h3-prompt-writing) has a VIDEO-EDITING format
  ("[video editing] The target video is an edited version of <Video 1>", <Subject N>, retention markers;
  `attribute_transfer` = a swap). Our template breaks the guide ("Do not show <Picture 1> ... its background" names
  the picture's room). `flow_graph_ours.EDIT_SWAP` = template 1 in that format, the clip's room a fully_preserved
  subject, picture's room never named. Preset `R2p_swap_keep_ours_edit_format` (room hand-written from frame 0; in
  the app it needs a FlowDef `describe` entry: op 1 + keep room -> Kept = the clip's place). NOT RUN: its waiter was
  withdrawn at 21:38 (Fabio: 6-7 agents waiting, don't be greedy), then re-queued on his "all good" with `--poll 60`
  so the faster-polling peers win the race first (log `r2p.log`).
- **R2p RAN: 12:30 (stage 1 10 x 31.9 s, stage 2 3 x 70.4 s) - THE ROOM IS KEPT** (fan, ceiling, sideboard, doorway),
  character as sharp as R2o, caption gone. One flaw: on the fast turn (1.9-3.3 s) it turns ~0.4 s late, like R2d;
  R2o (old prompt) turned on time. Sent `swap_four_way.webm` + `sync_strip_4.jpg`.
- **FABIO DECIDED: our graph + the new prompt** (brief.md § "Decided - Fabio, 2026-10-08 late"). NEXT, in order:
  1. Rewrite the other templates (PHOTO 2-6, NO_PHOTO 1-5, and the masked route's wording) in the EDIT_SWAP
     video-editing format, positive only - each picture's role as a subject with its retention marker; nothing to
     keep out is ever named. Move them into `flow_graph.py` (one template set), keep `flow_graph_ours.py` as the graph.
  2. Make `flow_graph_ours` the Flow's graph for BOTH routes (masked crop 512 -> stage 1 256 'match', stage 2 512
     'max'?) - bench the masked route (R1-style horns) on it before export; the box + swap LoRA sync (lag 0.00) must hold.
  3. FlowDef `describe`: add op 1 + keep room -> Input_Kept = clip first frame, PLACE ask; the template's {kept}
     holds the room (`js/data/flowsRegistry.js`, `tests/flow-describe.test.cjs`).
  4. Re-bench every option on our graph (person, picture room, head, outfit, background, masked) - poll 60 under
     the lease, the box is crowded; then re-export raw/ (`export_raw.py`) + `node scripts/sync-raw-workflows.mjs`.
  5. Fabio's in-app eye test, UNRELEASED.md, Phase 4 graphics.

2026-10-09 (Video edit 12):
- **Step 1 DONE: every template in the video-editing format, positive only, in `flow_graph.py`** (Fabio read the
  draft and said go). Template 1 (picture) = R2p's EDIT_SWAP with "handheld phone framing" -> "camera framing";
  `flow_graph_ours.py` no longer carries EDIT_SWAP / `edit_format` (R2p preset now passes `kept=`). Dropped every
  negation (GONE, "Do not show <Picture 1>", "never hold its pose", "without taking any person"); R5e's hair line kept
  positively in retention ("all of the hair, its lengths over the shoulders and down the back included"). No picture:
  the new look gets no <Subject N> (vendor: subjects come from reference assets), the words land in [Shot 1] as "The
  new character: {words}". LOOK dict gone ({look} sits inside subject_definitions). Fabio's picks: template 6
  (performance capture) opens `[reference generation]` (vendor 2.1: look from a picture, moves from a video), fall
  back to `[video editing]` if it benches worse; sound stays `[video editing]`, not `+ audio reuse` (one change).
- Graph: the masked line is now `{masked}` at the end of detailed_description (node 93 -> StringReplace 99), and the
  constraint line (node 98, `TAIL`) is ALWAYS last, both routes. In-graph describe (bench `caption=True`): Input_Kept
  is now the clip's ROOM (CAPTION_ASK[4]) for template 1 with a picture, the person for template 4 (nodes 174-176).
- All six S presets (`run_flow.py`: S7 masked horns vs R1b, S3 picture room vs R3f, S1 swap keep vs R2p, S4 background
  vs R4e, S5 head vs R5e, S6 outfit vs R6d; all `ours`, in-graph describe) validated offline against bench
  object_info, 0 faults. Queued one lease PER run (`s_all.sh` / `s_one.sh` / `s_all.log`, this session's scratchpad).
- **Step 3 BLOCKED on a peer:** MPI-1042 (session d2985589) claims `js/data/flowsRegistry.js`, `flowEnhance.js`,
  `tests/flow-describe.test.cjs` with uncommitted edits. Message 6edaf541 asks it to resolve when released. The entry to
  add: `{ to: 'Input_Kept', media: 'video1', frame: 'first', when: [op 1, Keep_Background true, { media: 'image1' }],
  ask: videoEditAsk(`Describe only ${VIDEO_EDIT_PLACE}. Leave out any people.`) }` + its test.
- **S7 (masked horns, ours + new prompt): 531 s vs R1b 460 s, and the R1b LOCK IS LOST.** `lag_full.py`: mean |lag|
  1.11 (R1b 0.01), worst -6..+5; per frame (scratchpad `lag_series.py`) the box's face error sits at ~20 vs R1b 5-10
  (the face in the box is re-drawn, head a touch off), and frames 53-69 trail the source by 1-6. Horns better, ears and
  caption gone, no seam. Stage 1 was 10 x 6.3 s at 256 px (half the 512 crop), stage 2 3 x 10 s; the rest is the 25 GB
  H3 TE running twice (once per refs node). Two variables moved, so **S7s = the new prompt on the SINGLE pass** is
  queued (`s7s.log`): lock back = the graph broke it (masked route stays single pass, or stage 1 at the full crop);
  still drifting = the prompt did. Sent `s7_vs_r1b.webm` + `s7_f62.jpg`.
- Fabio (2026-10-09): masked on the single pass if S7s locks, ours for the whole frame - "whatever works best for each".
- **TRAP for that: ONE graph cannot hold both H3 sections.** `MpiClearVram` is `OUTPUT_NODE = True` (MpiNodes `vram.py`),
  and ComfyUI starts from EVERY output node; a lazy MpiIfElse only spares what sits DOWNSTREAM of it. The single pass
  has 117, ours has 875 (frees the 25 GB TE before sampling), 711 (between stages), 861 (after decode) - so a combined
  graph runs both H3s on every route. `flow_graph_ours.graph(masked_single_pass=True)` builds that combined graph
  (574 Output_Preview dropped, swap LoRA ids 904/905) and is object_info-clean, but `check_combined.py` (scratchpad)
  lists those output nodes: do NOT ship it as is. Ways out: (a) the app picks the workflow per route - a field-keyed
  twin of `byModel` (`getUniversalWorkflow`, `modelRegistry.js:503`, its caller `commandExecutor.js:1350`,
  `universal_workflows.js` + the byModel tests, the last three held by MPI-1042); (b) an MpiNodes change - a lazy,
  switchable `MpiClearVram` (enabled=false never pulls its passthrough), then gate ours' three on "not masked";
  (c) masked on ours after all, if S7s says the prompt broke the lock.
- Fabio: **two graphs, the app picks** ((a) above). Waits on MPI-1042 freeing `universal_workflows.js` + tests.
- **S3 (performance capture, `[reference generation]`, ours): PASSED on my look - 692 s vs R3f 971 s.** Stage 1
  10 x 32 s, stage 2 3 x 60 s. Describer gave girl + bedroom (braids, bows, cream sweater, skirt, paw gloves, ears;
  bed, vanity, carpet, blinds). Full swap in the picture's bedroom, opens clean, dance step for step incl. the back view
  (both braids) and the arms-out end pose R3f missed; sharper than R3f. Sent `s3_vs_r3f.webm`; sheet `s3_sheet.png`.
- **S7s (new prompt, SINGLE pass, masked horns): LOCKED - mean |lag| 0.01, worst 0..1, box error 5-10 = R1b exactly.**
  484 s. So the two-stage graph broke S7's lock, not the prompt. Horns clean, ears + caption gone. => masked route =
  single pass + the new templates. Sent `masked_three_way.webm`.
- MPI-1042 committed + released the describe files (e7074e84e; message 6edaf541 resolved). DONE, uncommitted:
  - `flowsRegistry.js` describe: Input_Kept = the clip's room (PLACE ask, first frame) for op 1 + Keep_Background true
    + a picture; `tests/flow-describe.test.cjs` + case (11/11 pass).
  - Route pick `byParams` (twin of byModel): `universal_workflows.js` flowVideoEdit -> `flow_video_edit_masked.json`
    when Input_Target filled and Input_Operation != 4; `modelRegistry.getUniversalWorkflow(key, ids, params)`;
    `commandExecutor.js:1860` passes `payload.injectionParams`; `smoke-workflows.mjs` smokes byParams files;
    `inject-params-titles.test.cjs` counts them; `flow-model-choice.test.cjs` resolver + anchoring test (resolver
    passes; anchoring RED until `flow_video_edit_masked.json` is exported).
  - `export_raw.py` now writes BOTH: `flow_video_edit` = ours minus 574/570/571 (the stage-1 preview save, never
    captured on a Flow run), `flow_video_edit_masked` = flow_graph single pass. NOT run yet: waits for S1/S4/S5/S6.
- **S1 (swap, keep the video's room, room DESCRIBED from frame 0 = the app's path): = R2p.** 781 s. Describer: "a dimly
  lit indoor space with a dark ceiling fan ... black countertop ... doorway ... two framed pictures". Room kept, full
  swap, caption gone; same ~0.4 s late turn as R2p/R2d; the source's own play icon survives on frame 0 (R2p too).
  Sent `s1_vs_r2p.webm`.
- Docs updated (uncommitted): `existing-flows/video-edit.md` (two graphs, the format, the output-node trap, two-file
  export, bench timings), `any-of-models.md` (one-line `byParams` pointer; file held at its 200-line budget),
  `flow-packages.md` (no byParams in packages). smoke arm marked `arm: <file>` (smoke-flows counted a null arm as
  a second default). RED until the masked file exists: flow-model-choice anchoring, inject-params-titles,
  smoke-flows "wfFile exists" - all three only on `flow_video_edit_masked.json` ENOENT.
- **EXPORTED both graphs** (before S4-S6 finished; masked was settled by S7s, re-export if a template changes):
  raw committed 2f72ee04b (sync script, local, not pushed), generated API STAGED, 0 diffs vs builder, injection rules
  green. Full suite 2820/2822 pass, 0 fail. Browser pane tab on :8188 (bench frontend) used for loadApiJson/serialize.
- **S4 (background, ours + new template 4): FAILED the performance.** 671 s. Bedroom right, dancer's own look right
  (describer kept her: blonde, black top, green shorts), back turn on time - but the ARMS are her own routine, not the
  source's (frames 2/3/5/6 of `s4_sheet.png` differ; R4e followed). Split queued (`s4_split.sh` / `s4_split.log`):
  **S4s** = new template on the single pass, **S4o** = R4e's exact old template on ours (`instr` override of node 74).
  S4s follows -> op 4 is a graph problem (fix: op 4 -> the single-pass file via byParams); S4o follows -> the template.
- **S5 (head, ours + new template 2): FAILED twice.** 761 s. (1) the blonde lengths are BACK under the dark bun (the
  R5d hybrid) - R5e's "All of {who}'s own hair goes ..." line, rewritten positively into retention_analysis, does not
  carry it; (2) the arms re-perform, as in S4. Pattern: S4/S5 = `[video editing]`, swap LoRA OFF, on ours -> own
  moves; S1 (LoRA on) and S3 (`[reference generation]`) follow. **S4L / S5L = S4 / S5 with the swap LoRA forced on**
  queued (`s_lora.sh` / `s_lora.log`, `lora` preset key sets node 21 to '1 > 0'). Hair needs its own fix after.
- **S4s (new template 4, SINGLE pass): FOLLOWS the source move for move** (= R4e; sheet `s4s_sheet.png`, rows source /
  R4e / S4 / S4s). 1011 s. So the new prompt is fine; ours with the LoRA off re-performs. S4L decides: ours + LoRA
  for every whole-frame option, or ops 2-5 to the single-pass file (byParams).
- **Fabio (2026-10-09): fix OURS rather than retreat** - the 4 min gained on 5 s grows with clip length. And S5 fails on
  the hair too. Shipped graph read: stage 1 (Turbo on) = turbo LoRA, BasicScheduler beta 10 steps, euler, shift_video
  12, at HALF size; stage 2 = the BASE model (586 picks 523 = EasyCache + shift when Turbo is on), euler 3 manual
  sigmas 0.9035/0.6316/0.3158/0, BasicGuider cfg 1, refs `max`; windowing off at 576x1024 (739: 100000 frames).
  The single pass = turbo, res_multistep, simple 8 steps, no explicit shift, full size. Suspects: stage 1's small
  size/sampler, or stage 2 re-drawing 90% with the base model. Diagnostics queued: S4L/S5L (swap LoRA on both
  stages), **S5p = S5 stopped after stage 1** (`preview` key: 567 is_preview -> Output_Preview `_stage1` file).
- Template 2 + no-picture 2 hair line, positive: "All of <Subject 2>'s hair is <Subject 1>'s hair, at the length and
  in the style it has in <Picture 1>: over the shoulders and down the back, <Subject 2> shows that hairstyle and only
  that." (S5L and S5p carry it; the exported app graphs do NOT yet - re-export after.)
- **S6 (outfit, ours): FAILED - identity leak + moves.** 771 s. Outfit right, but the picture girl's FACE and dark bun
  came too (blonde lengths under the bun from behind); R6d kept the dancer. Points at stage 2 (base model, 90% re-draw,
  picture at `max`). S4o cancelled (S4s already cleared the prompt; waiter pid killed, ticket released).
  **S6z = S6 with stage 2 from 0.6316** (`sigmas2` key -> node 600; Fabio's `max` on stage 2 kept) queued (`s6z.log`).
- Fabio: "she repeats the move on ours, that's why she gets behind and stays behind". `lag_series.py` on the head
  swap (room unchanged, so frames compare): R5e +1/+2 throughout; S5 tracks frames 0-22, loses the source ~30-100
  (|offset| >= 12), re-locks for the last second. (Whole-frame lag is MEANINGLESS when the room changes: S4s reads
  as bad as S4 though it follows by eye.)
- **S4L (swap LoRA on both stages): STILL out of step** (hands crossed for the head touch, a side turn for the back
  view). LoRA ruled out; S5L cancelled (waiter killed). Latent upscaler ruled out by reading it: chunk=32 latent
  frames, T=37 here -> 2 chunks, overlap 5, a 1:1 time-preserving weighted blend (`minimax_h3_latent_upscaler_3d.py`
  forward), no frame can repeat. Left: stage 1 (half size, euler/beta 10, shift 12) or stage 2 (base, 0.9035).
- **S5p (stage 1 only, `S5p_head_stage1_only_stage1_00001.mp4`, 288x512): SAME break as the final S5** (lag series
  identical: tracks 0-22, lost ~30-100, re-locks at the end). => the break is born in STAGE 1; stage 2 keeps it.
  Fabio: "the first few frames are repeated", with or without the LoRA. Shift is 12 in both (ComfyUI
  `supported_models.MiniMaxH3.sampling_settings`), so not that. Prime suspect: node 519 `ModelAttentionBackend`
  "comfy kitchen attention" = QUANTIZED INT8 attention (its own tooltip), on both stages, not in the single pass.
  Stage-1-only splits queued (`s_stage1.sh` / `s_stage1.log`, `patch` preset key): **S5pa** 519 -> pytorch attention,
  **S5pb** stage-1 sampler res_multistep + simple 8 (= the single pass's).
- **S6z (outfit, stage 2 from 0.6316): = S6** - same face leak, same moves (sheet `s6z_sheet.png`), 681 s vs 771 s.
  Confirms stage 1 owns BOTH faults (the picture's face too); stage-2 start is not the lever.
- **S5pa (pytorch attention, stage 1): = S5p frame for frame**, and 51.5 s/it vs 31.9 - INT8 attention CLEARED, keep it.
- **THE BUG, seen** (`s5p_frames18_48.jpg`, rows source / R5e / S5p): ~1 s in, S5p's stage 1 jumps BACK to the
  clip's opening pose (hands at the chest) and even redraws the frame-0 play icon, then trails ~24 frames - Fabio's
  "first few frames repeated". Core `MiniMaxH3References` encodes a ref VIDEO at its own size (`adapt_canvas` keeps a
  smaller-than-canvas video as is; `ref_image_size` only sizes pictures), all 124 frames, no trim. So stage 1 gets a
  576x1024 <Video 1> against a 288x512 target (2:1); the single pass has 1:1. **S5pr** = stage 1 with the clip
  shrunk to the stage-1 size for node 330 (`ref1_small`: ImageScale 906 from node 60 at 621x620) queued (`s5pr.log`).
- **S5pb (stage-1 sampler = the single pass's: res_multistep, simple 8): SAME break.** Sampler CLEARED. 450 s vs 551
  (8 steps vs 10) - worth keeping in mind as a speed-up once sync is fixed.
- **S5pr (clip shrunk to the stage-1 size for stage 1's refs): replay STAYS** (`s5pr_frames0_60.jpg`: from ~frame 24
  it replays frames 8-16, never reaches the turn by 60) - but stage 1 is 3.3x CHEAPER (9.5 s/it vs 32, 260 s whole
  run): keep `ref1_small` whatever fixes the sync. Cleared so far: attention, sampler, shift, upscaler, stage 2, ref
  scale. Left: the turbo LoRA (trained 768p) at 288x512. Queued (`s_stage1b.sh`): **S5pn** stage 1 on the BASE model
  (444 Turbo off = the graph's own non-turbo path, 25 steps), **S5pq** turbo at 0.75 size (620/621 -> 448x768).
- **S5pn (BASE model, 25 steps, EasyCache skipped 12/25, 4.86 s/it, 280 s): SAME replay** at the same frames
  (`s5pn_frames0_60.jpg`). Turbo CLEARED. Loaders identical to the single pass (same unet / TE / video VAE / audio
  VAE files); 330 gets the same clip, picture, length, seed as 110. The ONLY difference left: the target size
  (288x512 vs 576x1024; the picture is also sized to that area by `match`). Every stage-1 variant replays at the same
  frame, so it is structural, not sampling. S5pq (0.75) decides whether it is the size.
- **S5pq (turbo, 0.75 = 448x768): SAME replay, same frame.** 27.6 s/it. Every stage-1 variant (0.5/0.75, turbo/base,
  euler-beta/res_multistep-simple, INT8/pytorch attention, ref at 576 or at stage size) replays at ~frame 24.
  Ancestor diff of 565 vs 115 (scratchpad `ancestors.py`): beyond those, only shift_audio 4 (base path: 2), the six
  `Input_Lora_*` MpiLoraModelClip 'None' pass-throughs (CLIP for the refs comes through them), the 873/875/879 pack +
  MpiClearVram. Control queued: **S5h = the SINGLE PASS at half size** (render area 147456 -> 288x512, clip too)
  (`s5h.log`). Replays -> H3 cannot follow at that size in any graph; follows -> ours' plumbing.
- **S5h (single pass, half size): SAME replay** (170 s; frame 28 redraws the frame-0 play icon + opening pose,
  `s5h_frames0_60.jpg`). Ours' plumbing CLEARED. But every S5 run carries the NEW template 2 and R5e (the only head
  swap that followed) the OLD one -> **S5ho = S5h with R5e's exact old template 2** (`patch` on node 72, `OLD_T2` in
  run_flow) queued (`s5ho.log`). Follows -> the new template 2 causes the replay, not the size.
- **S5ho (OLD template 2, single pass, half size): SAME replay.** => **ROOT CAUSE: H3 loses the moves when it RENDERS
  below ~full size** - 288x512 and 448x768 replay (~frame 24 jumps back to the opening) in ANY graph, with ANY prompt,
  sampler, attention or model (turbo/base); the single pass at 576x1024 follows (R5e, S4s). So "ours" can never hold
  sync with a half-size stage 1 for these edits (S1/S3 got away with it; op 2/3/4 do not). The speed lever that
  survives: the REFERENCE clip's tokens (S5pr: stage 1 3.3x cheaper with the clip at stage size).
  **S5sr = the single pass at FULL render size with the clip handed in at HALF size** (`ref_half`: 907/908 half
  math -> ImageScale 906 -> 110.ref_video_1) queued (`s5sr.log`). Compare speed with R5e (991 s) and sync.
- **S5sr (single pass, full render, clip at HALF size): IN SYNC** (lag +1 throughout = R5e) **in 461 s vs R5e 991 s**
  (8 x 48 s/it vs ~105) - faster than ours too (S5 761 s). BUT the head barely swaps: the source's blonde hair stays
  (front and back), the face only half changes (`s5sr_sheet.png`, `head_four_way.webm` sent). Two variables vs R5e
  (half clip + new template 2): **S5sro = S5sr + R5e's old template 2** queued (`s5sro.log`).
- **S5sro (half clip, OLD template 2): in sync (451 s), stronger swap than S5sr but a HYBRID** - face changes, dark bun
  from behind, blonde lengths under it, the last frame reverts (`s5sro_sheet.png`). R5e (full clip) swapped fully. So
  (1) the half-size clip weakens an identity edit, (2) the positive hair line is weaker than R5e's "All of {who}'s own
  hair goes ...". Queued (`s_ref.sh`, old template kept): **S5s75** clip at 0.75 (`ref_frac`), **S5srL** half + swap LoRA.
- **S5s75 (single pass, clip at 0.75, old template 2): FULL SWAP (= R5e), IN SYNC (lag +1), 641 s vs R5e 991 s
  (-35%) and vs ours S5 761 s.** S5srL (half + LoRA): still the hybrid - the LoRA does not strengthen identity.
  => **THE FIX: the whole frame on the SINGLE pass with the clip handed in at 0.75 of the render size.** Ours (two
  stages) is out for this Flow: its half-size stage 1 cannot hold time (root cause above). If every option passes on
  it, the Flow is ONE graph again (masked = crop 1:1, whole = clip at 0.75) and the `byParams` two-graph pick has no
  consumer - remove it then. Queued (`s_x.sh` / `s_x.log`): S4x, S6x, S1x, S3x = every whole-frame option on it.
  Open for Fabio: R5e's hair line back in template 2 (the positive rewrite failed twice).
- **S4x (background, clip 0.75): PASS** - = S4s move for move, bedroom right, dancer as filmed; 661 s vs 1011 s.
- **Fabio stopped the bench (17:57): other agents were waiting for the GPU.** S6x (outfit, clip 0.75) was left to finish
  (`D:/WORK/Images/Outputs/mpi1036/S6x_outfit_ref075_00001.mp4`, NOT judged yet - compare with R6d: face kept? moves?).
  S1x / S3x CANCELLED (loop killed). Fabio may move the remaining runs to RunPod (he checks); timings on his 16 GB
  card are already in hand.
- **INTERIM SAFETY (his app runs from this tree):** `comfy_workflows/flow_video_edit.json` + `raw/` = a COPY of the
  single-pass masked file (`export_raw.GRAPHS` both `fg.graph`), so both routes run the single pass (in sync, slow).
  Builder diff: 0 except template 2 (nodes 72/82) - the exported graphs predate the positive hair line in
  `flow_graph.py`. Tests 122/122 (flow-model-choice, inject-params-titles, smoke-flows, flow-describe,
  workflow-media-slots, user-flows, agent-flow-handover). `video-edit.md` carries an INTERIM banner.

2026-10-09 (Video edit 13):
- **The "cancelled" S1x / S3x RAN ANYWAY** (`s_x.log`: S1x 17:59-18:11, S3x 18:11-18:23, after Fabio's 17:57 stop) -
  the loop kill did not land. Outputs on disk, so no local-vs-RunPod question left. Lease free at 19:25.
- Sheets (this session's scratchpad `sheet.py` OUT clip...; frames 5/24/40/62/82/110): `s6x_sheet.png`,
  `s1x_sheet.png`, `s3x_sheet.png`. **All four whole-frame options PASS on single pass + clip 0.75:**
  - **S6x (outfit) = R6d:** dancer's face + blonde hair kept, moves follow (lag +1/+2 throughout, R6d's own pattern;
    S6's face leak gone). 671 s vs ours S6 771. One difference for Fabio's eye: S6x keeps the dancer's green shorts
    under the sweater, R6d dropped them (bare).
  - **S1x (swap, keep room) >= R2p:** full swap, room kept, same ~0.4 s late back turn as R2p; frames 80-105 lag 0
    where R2p reads +-12. Keeps the source's green shorts (R2p pink). Frame-0 play icon survives (as R2p). 711 s vs S1 781.
  - **S3x (picture + its room, `[reference generation]`) = R3f:** full swap in the picture bedroom, back view (braids)
    and hand-on-head on time, arms-out end. 691 s vs R3f 971, = ours S3 692.
  => Step 3 (one graph, clip at 0.75 for the whole frame) is cleared on the bench.
- Fabio (2026-10-09): **R5e's hair line** in template 2; bare legs are fine (outfit = only what the reference shows,
  extras via the words field - memory `feedback_outfit_only_what_reference_shows`). S6x passes as is.
- **STEP 3 DONE - ONE graph again.** `flow_graph.py`: template 2 (+ no-picture twin) detailed line = R5e's "All of
  {who}'s own hair goes, the lengths over the shoulders and down the back too; the hairstyle is the one in <Picture 1>."
  (retention line unchanged); nodes 43/44 = render w/h x 0.75 (/32) -> node 42 resizes the whole frame straight to that
  (one resample; the bench did 576x1024 then 906 down). Render (61/62) stays full; masked crop 1:1. `byParams` removed
  by reverse-applying 596e787ed's hunks (universal_workflows, modelRegistry, commandExecutor, smoke-workflows, 2 tests,
  flow-packages, any-of-models); `video-edit.md` rewritten (one graph, why 0.75). `export_raw.py` = one graph.
  Export: push -> bench tab loadApiJson/serialize (81 nodes, 118 links) -> pull -> sync (raw committed 8472ea0c7 LOCAL,
  masked raw deleted in it; generated API staged; `flow_video_edit_masked.json` git rm'd, staged). Synced vs builder 0
  diffs; injection rules green; targeted 121/121; full suite 2824 pass / 0 fail / 2 skipped.
  - Sync trap: it refuses a staged GENERATED deletion and `git add`s a deleted raw path (fails if already `git rm`'d):
    plain `rm` the raw, keep the generated file until the sync has run, `git rm` it after.
  - UNBENCHED combination: new-format template 2 + R5e line + clip 0.75 never benched (S5s75 = OLD_T2 whole + 0.75).
    The head swap is the eye test's first run. run_flow `ref_frac`/`ref_half` presets now stack on node 42's 0.75.
  - Fabio's open app may hold the OLD universal_workflows (byParams -> deleted masked file): restart before testing.
- **Fabio's eye test, run 1 (his app, head swap, pink-curls head close-up, Who "the person", no words):** 441 s (8 x
  46 s/it). IN SYNC frame for frame (back turn too), face + ombre colour swapped, but the LENGTH is the dancer's
  (curls to mid-back; the picture cannot show where its hair ends). Sheet: scratchpad `app_head1.png` (`FRAMES=` env,
  `fps=24` - his source crop is 48 fps). Next run: his words for the length, Only change EMPTY.
- Field copy from his test (Fabio confused Who / Only change / Describe): `Input_Who` label "Which person" + `info`
  hover; `Input_Target` note = "A mask: list what to change, separated by commas..." (SAM3 tokenizer splits commas,
  one search each, masks unioned - `comfy/text_encoders/sam3_clip.py`), placeholder "e.g. head, hair"; `positive`
  label "Describe the new look", placeholder "e.g. short pink curls that end at the jaw". `declaredFields.js` text
  branch now passes `info` to MpiInput (status-bar hover; fields.md says so). description + agent flows.md updated.
  Flow tests 740/741 (1 skip), full suite before the last copy change 2825/0 fail.
- **Describe reused on a repeat run** (Fabio): `flowEnhance.describeFlowRun` caches by [url, crop, frame, ask, describe
  backend, describe model] in a session Map (`deps.cache` for tests; stubbed describers do not cache). Test added.
- **Run 2 (his app, MASKED "Head", words "shoulder-length"): 11:09 vs whole-frame 7:21.** Hair still long (run 1's
  describer ALSO said "shoulder-length": H3 keeps the clip's hair length when the picture does not show where it ends -
  a model limit; a head-and-shoulders picture or a character sheet is the user's lever). Breakdown: SAM3 + crop 2:18,
  loads 0:36, 8 steps 3:00 (21 s/it at 512), post 5:14. CPU bench (scratchpad `post_bench.py`, `grade_fix_bench.py`,
  engine python, CUDA hidden): **MpiGradeMatch 3.2 s/frame** (97x97 max_pool2d ring per frame) and **crop
  mask_fill_holes 0.85 s/frame** at 1072x1920; stitch ~0.03 s/frame.
  - FIX 1 (MpiNodes 88816c8, pushed): ring separable + built once per still mask, identical output, 32.4 s -> 0.2 s /
    10 frames; tests/test_grade.py 6/6. **NOT PINNED: MPI-623 (1afa8c46) holds node_lock.json (uncommitted db3bdc7 bump)
    + MpiNodes changelog.md - message b74e6705 asks it to pin 88816c8 + add the changelog line.**
  - FIX 2 (flow_graph node 54): mask_fill_holes False (one solid square = no-op), exported + synced (raw 49bb04537,
    API staged, 0 diffs). device_mode stays cpu: gpu mode moves the WHOLE clip to VRAM (4K x 10 s = ~24 GB).
  - Committed locally 347aca55f (one-graph + fields + describe cache + byParams removal), NOT pushed.
  - Fabio said copy it in: the fixed grade.py is HAND-COPIED into his engine
    (`engine/.../custom_nodes/ComfyUI-MpiNodes/grade.py`, gitignored; original = pre-fix HEAD, backup in session
    c646905a scratchpad `grade_engine_backup.py`). The pin (MPI-623) makes it official; an engine node sync before
    that may overwrite the copy with the old pin's file.
  - **Run 3 (after restart, both fixes live, same masked head swap): 318.55 s = 5:19 vs 11:09** - describe 1.8 s,
    SAM3 + crop 69 s (was 2:18), loads 38 s, 8 steps 3:05, post 20 s (was 5:14). Masked now beats whole frame (7:21).
    Fabio: short hair "is a limitation" - H3 keeps the clip's hair length (doc it in video-edit.md + Cosmo).
  - Mask reuse across runs: ComfyUI's own cache should skip SAM3 on an identical clip + target (loader has no
    IS_CHANGED, path stable); run 2 was the first mask. UNVERIFIED - check the log on his next repeat.

- Likeness: run 1 (whole) and run 3 (masked) give the SAME face - picture colouring, face shape nearer the dancer.
  Fabio thinks it is the clip's quality / face distance and is testing a higher-quality video himself. Identity
  adapters noted in brief.md `## Noticed` (Faceswap LoRA, RefMods, fal Realism, akatz).

**Video edit 14 (2026-10-09), running notes:**
- Faceswap LoRA: `UntMods/FaceSwap_MiniMaxH3_REF2VA`, `SS_FaceSwap_MiniMax_H3_REF2VA.safetensors` 65,623,904 B, sha256
  `1e032cf5...0326d` (= HF lfs), Apache-2.0 (an H3 fine-tune, so the H3 licence likely binds too; the H3 gate covers
  it). Header: ai-toolkit, base `minimax_h3_ref2va`, rank 16, 4,500 steps, every caption the one word "FaceSwap",
  ~half the blocks pruned. Author's graph = our int8 transformer + our turbo LoRA, prompt = the trigger alone.
  Downloaded to `G:/CubricModels/loras/minimax-h3/` (Fabio's yes).
- **Two MASK FAILURES in Fabio's app, both masked "Head":** close-up `videoCrop_002` (448x800) left the crown blonde;
  dance `videoCrop_001` (1072x1920) showed a box seam across the hips. Measured from the files (median |result -
  source|, scratchpad `boxfind.py`): BOTH pasted squares = the frame WIDTH (448 / 1072). ROOT CAUSE:
  `square_bbox_from_mask` caps the side at min(W, H) and centres it, so a union box taller than a portrait frame is
  wide gets CUT (crown above y~50 never re-rendered) and the square runs head-to-hips (its edge crosses the moving
  body). Image workflows are NOT affected: there the square is only `optional_context_mask`, the painted mask is
  never cut. Fix (flow_graph): node 55 "Square holds the whole mask?" = size < W and size < H; node 24 (lazy IfElse
  on 23) feeds all six masked consumers (21, 60, 61, 62, 93, 122) - a capped square runs the whole-frame route.
  Exported, synced (raw `1d336bc8c` auto-committed by the sync; generated STAGED), +2 nodes / +6 links, 50 tests pass.
  Cost: the dance clip's masked run falls back to whole frame (7:21, not 5:19) - correct beats fast.
- Fabio: the close-up (`videoCrop_002`) WAS his higher-quality clip - likeness still weak. So clip quality / face
  distance is NOT the cause; an identity adapter is the lever (T2).
- **T1 (300 s): fell back (576x1024 out = whole frame), crown fixed, curls every frame, follows the side turn (~3
  frames early on the turn back). Fabio: "the likeness is much better"** than his masked 004 on the same clip.
- **T2 (T1 + Faceswap LoRA under turbo, "Faceswap" opening the prompt; 251 s, no "lora key not loaded"):** heavier
  dark brows, longer narrower face, paler skin - I read it closer; **Fabio: T1 and T2 have the SAME likeness** (no
  clear LoRA gain on this clip). Ship decision waits for the clean-dancer A/B. Bench
  key `faceswap` in run_flow.py. Side-by-side: session f255403e scratchpad `headswap_picture_masked_T1_T2.webm`.
- Fabio: test clips are screen recordings; make our own TikTok dancer at 1088x1920 with H3 (ref2va only on disk,
  no LTX: his drive is full), prompted per `docs/agent/models/minimax-h3.md`.
- **Test dancer** (`research/bench/gen_dancer.py`, shipped `minimax_h3_r2va.json`, no refs = t2v, 1088x1920 turbo,
  4 s -> 3.75 s, seed 20261009, 435 s): `D:/WORK/Images/Outputs/mpi1036/dancer_1088x1920_00001.mp4`, bench input
  `mpi1036_dancer_1088x1920.mp4`. Full body (asked head-to-knees), face small; side turn + look back, ends hands on hips.
- **D1/D2/D3 on it** (T1's picture/words/seed): D1 whole 430 s, D2 whole + Faceswap 422 s (no LoRA cost), D3 masked
  "Head" 591 s - square ~rows 330-1000 (head + hair to the chest) FITS, so masked ran; in sync through the side turn,
  crown clean, no seam seen. D2 face narrower/paler/heavier brows than D1 (my read). D3 timing: SAM3 + crop 71 s,
  loads 35 s, 8 steps 167 s (vs 356 s whole), post 302 s - the BENCH runs the PRE-88816c8 grade (started 18:49,
  fix 20:00; not restarted, shared box), so in the app masked ~5:10 vs whole ~7:10. 4-way clip: session f255403e
  scratchpad `dancer_src_D1_D2_D3.webm`. **Fabio: D2 looks closer than D1** (the LoRA helps on a clean source; on
  his screen-recorded close-up T1 = T2). **D4 = D3 + Faceswap** (stacked on the swap LoRA, 611 s): in sync through
  the turn, crown clean; face vs D3 subtle (a bit narrower, sharper brows); D2 still reads closest to me. Upper-body
  clip `dancer_src_D2_D3_D4_upper.webm`. **Fabio: SHIP the Faceswap LoRA on Swap the head, BOTH routes; D3 (masked,
  no Faceswap) is a lot worse in likeness than D2 and D4** (not a failure, just worse).
- Bench T1 (his close-up run, fixed graph -> should fall back) + T2 (T1 + Faceswap LoRA + trigger), queued in one
  lease behind MPI-1041's Qwen batch; log in session f255403e scratchpad `t12.log`.

- **SHIPPED (committed, push held by MPI-623's red master):** `ee27e3a58` square cap -> whole frame + docs (video-edit.md,
  docs/agent/flows.md: when a mask pays, hair length); `85515d7de` Faceswap LoRA on op 2 both routes (nodes 25,
  145-149; dep `minimax-h3-faceswap-lora` in loraDeps.js + flowsRegistry requiredDeps; licence gate is per Flow, so
  no licences.js change). run_flow's bench `faceswap` key REMOVED (built in now); flow_graph_ours FLOW_H3 += 145-149.

**Video edit 15 (2026-10-10):** Cosmo routing DONE (agentBench case `video-hair-to-video-edit`, 3/3 + bite, $0.0243;
services/agentBench.mjs uncommitted). In-app run #1 died on APP_UNAVAILABLE (submitted before the window subscribed);
overnight_inapp.py now waits on /connector/capabilities, re-queued 00:52; ran 01:26-01:40: E1/E2 ok, no Faceswap
download, E2 in sync (lag 0.12 = D4), side-by-side sent (logs/mpi1036/VE15_inapp_head_swap_sbs.webm). E1 whole carries
the picture's halter neckline onto the dress; E2 masked does not. Fabio: "Looks good"; 4 Cosmo routing cases 12/12 (c2b58901e); UNRELEASED.md entry done. NEXT: Fabio's own UX try (he
reports back; he is trying a RunPod Pod too - first Video Edit run on a Pod, dev image v0.26.0-dev), Phase 4 graphics.
MpiNodes pin DONE: node_lock d721182 (MPI-623) descends from 88816c8.
Fabio 2026-10-10 after the Pod runs (PRO 6000: run 1 4 min, run 2 2 min): output "looks like crap once I zoom in" - an
H3 quality problem, not the Flow. He will research NEW H3 upscale methods (users get better results than ours); the
Flow JSONs may change later for them. Meanwhile he tests an LTX upscale on the result and the other operations on an
RTX 5090 Pod. Wait for his findings; do not start upscale research unasked.

**Video edit 16 (2026-10-10):** Fabio's findings + asks, all built (commits e5415ea3c, b1bbd21f3, 8df236b61, then
MpiBaseFlow/registry/docs): (1) WHOLE-FRAME STRETCH - core H3 stretches the reference video onto its own /32 canvas
(crop disabled) and the output follows it; 0.75 per axis (448x768 for 576x1024) was ~4% wide, so each whole-frame pass
grew the subject taller ("10 ft. tall soon"); masked was fine (stitched at source size). Node 44 picks the first of 3
/32 heights from 0.75 within 1% of the render's shape (448x800), else full size; scratchpad check over 12 sources x 6
tiers. (2) RESOLUTION field Input_Quality (render AREA: 576p default, 768p, 960p, 1080p, 2K, 4K; masked crop = 512 at
576p else the tier's short edge, node 63). 2K/4K warned (MPI-549 OOM on a 32 GB 5090 with refs). (3) LoRA COGWHEEL
("all flows ... just most things"): Upscale Video, Video Edit, Extend Video (LTX retitled, H3 980-985), Character Sheet
from Images (Qwen + Klein); NOT Foley, NOT Outpaint (Fabio). Raw racks inserted in place (LiteGraph JSON: copy the
MpiLoraModel(Clip) node, rewire, bump last ids), then sync. Message 2ea083d1-mpi1036-to-mpi1041 asks MPI-1041 to rack
the Character Sheet Editor. (4) Flow input slot = 512 thumbnail (resolveDisplayImage(url, 512), Map per Flow).
NEXT: Fabio's eye on (1)-(4) (his 1080p Pod run is the first stretch-fix run); then Phase 4 graphics. Video slots still
load the whole clip (a picked gallery item's proxyPath is dropped at MpiBaseFlow onPick) - not done, his call.
Later the same day, Fabio's 1080p Pod runs (5090, ~60 s a step, 8 steps; the status bar sat at STARTING 0% through
step 1 - status-bar progress, MPI-1057/1059's files, not ours): "Swap the person" + "The picture's room" swapped the
PERSON right (the picture's woman) but the ROOM went back to the clip's living room (the step previews start on the
picture's shower, then settle on the clip's room), and she turned her back at the end, which the clip never does.
Change the background ALSO failed 3x earlier that day on his bedroom picture (sidecars 11:14-11:18: room unchanged).
The picture: a low, floor-up camera with enough background (Fabio); a top-down view worked in an earlier test. The
description named the room fine ("stands in a tiled shower ... wall tiles, metallic showerhead"), so not the describer.
Suspect: whole-frame <Video 1> carries the clip's room in every frame and wins. NEXT (Fabio APPROVED bench runs on
his local bench, under the GPU lease): improve the room path - prompt revision and/or hand H3 the clip with the
dancer cut out (BiRefNet, an engineAsset) for Change the background + template 6 only; A/B on his shower picture
(template 6) and bedroom picture (op 4) at 576p. He is also judging the 1080p result's quality and doing one more
stretch run (compare height to flowVideoEdit_002, itself made BEFORE the fix).
Fabio, after the 1080p result: "resolution did help"; he expects 2K/4K to give really good results (try them on a
big-VRAM Pod - MPI-549 OOMed H3+refs at both on a 32 GB 5090).
Fabio: MPI-549 predates the H3 MODEL graphs' tiled stage 2 (MpiWindowedSampler in minimax_h3_r2va/fl2va). Video Edit's graph
is SINGLE pass (SamplerCustomAdvanced only), so its 2K/4K still sample the whole canvas + the reference clip at once:
the warning stays. Candidate (pending Fabio's yes): a Video Edit stage 2 - edit at 768p/1080p, then the H3 latent
upscaler + MpiWindowedSampler to 2K/4K, as the model graphs do. Bench after the room fix.

**NEXT (after Video edit 14), in order:**
1. DONE: pushed 1973b7c60..070279498 after MPI-623's fix went green.
2. In-app test of the shipped graph - Fabio could not (agents hold the GPU for hours), so it runs UNATTENDED: queued
   2026-10-10 00:33 under the lease (`research/bench/overnight_inapp.py`: own app:isolated, run_in_app.py E1 whole + E2
   "Head" on the test dancer, then a process-tree teardown). READ `research/bench/overnight_inapp.log` (+
   `overnight_app.log`, `overnight_lease.log`): the E1/E2 lines carry each result's file path. Check: no Faceswap
   download (file on G:), E2 masked in sync, faces like D2/D4; send Fabio a side-by-side (VP9 WebM). If the log is
   missing or says "command not run", the lease timed out (12 h) - re-queue. It lives in session f255403e's
   background: if that session was closed before it ran, re-queue the same command (header of overnight_inapp.py).
3. Cosmo live check (checklist), MpiNodes pin via MPI-623 (message b74e6705), UNRELEASED.md roster + entry, Phase 4
   graphics.

**NEXT (Video edit 14), DONE above:**
1. Fabio asked (2026-10-09): DOWNLOAD the H3 "Faceswap" LoRA (ref2va, trigger "Faceswap"; find the HF repo from
   https://hackernoon.com/faceswap-minimax-h3-lora-a-practical-guide-to-face-replacement) to `G:/CubricModels/loras/
   minimax-h3/`; state file + size first. Check its licence. Bench head swap on it vs today's (bench single pass +
   clip 0.75; lease per run, ASK before queueing - the box is shared). Ask Fabio for his higher-quality clip's result.
2. Write the limits into `existing-flows/video-edit.md` + `docs/agent/flows.md`: hair LENGTH follows the clip unless
   the picture shows where it ends (a bun works); a mask pays only on a small part that stays put. Then the Cosmo
   live check (checklist).
3. Pin: message b74e6705 to MPI-623 (pin MpiNodes 88816c8 + changelog line). Until pinned, Fabio's engine runs a
   HAND-COPIED grade.py. Optional: a repeat masked run proves SAM3 + describe reuse (log: "reused").
4. Push 347aca55f + the staged sync (raw 49bb04537 already local), UNRELEASED.md roster + entry, Phase 4 graphics.

**NEXT (after Video edit 13): steps 1-3 below DONE. Left: step 4 - Fabio's in-app eye test (head swap first, then a
masked edit), then the UNRELEASED.md roster + entry, then Phase 4 graphics.**

**NEXT (Video edit 13), in order:**
1. Judge S6x (outfit, clip 0.75) vs R6d. Then run S1x + S3x (`run_flow.py` presets exist; one lease each; ASK Fabio
   first whether local or RunPod, the box is shared).
2. Fabio's call on template 2's hair line: R5e's "All of {who}'s own hair goes, the lengths over the shoulders and
   down the back too; the hairstyle is the one in <Picture 1>." (worked) vs the positive line (failed twice: S5, S5sr).
3. Build the fix into `flow_graph.py`: whole-frame route feeds `110.ref_video_1` the clip at 0.75 of the render size
   (IfElse on node 23: masked keeps the crop 1:1); masked stays as is. One graph again: delete the `byParams` switch
   (universal_workflows, modelRegistry `_paramHolds`, commandExecutor arg, smoke arm, the flow-model-choice test,
   the inject-params-titles line, docs `any-of-models.md` pointer + `video-edit.md`), drop `flow_video_edit_masked.json`
   + its raw, and `flow_graph_ours.py` stays as research only. Re-export (`export_raw.py`), sync, diff, full suite.
4. Fabio's in-app eye test (both routes, app:isolated), UNRELEASED.md, Phase 4 graphics.
- run_flow refactor: `build(name)` applies every bench override (`BENCH_KEYS`); scratchpad `check_graphs.py` now
  validates through it (no copy of the override logic).
- NEXT: judge S4 (background) / S5 (head) / S6 (outfit) as they land; if all pass -> Fabio's in-app eye test (both
  routes; app:isolated, its own port), then UNRELEASED.md, Phase 4 graphics. Uncommitted: flowsRegistry, describe
  test, byParams (universal_workflows, modelRegistry, commandExecutor, smoke-workflows, 2 tests), 3 docs, card files.

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

- 2026-10-10 (Video edit 16): scope grew on Fabio's asks - the user LoRA cogwheel on four more Flows, a Resolution
  field, Flow input thumbnails - and a real bug (the whole-frame stretch from the 0.75 reference clip) was fixed.

- 2026-10-08: the talking/acting-clip test through mode F is DROPPED - Fabio: the Phase 1 dance
  runs already carried the face, expressions, mouthing the song in sync and the right audio, at
  a distance from the camera, so performance capture's face/lip-sync question is answered.
- 2026-10-08: Phase 2's shape-mask paste (the plan's InpaintCrop/Stitch round the SAM3 mask) FAILED
  on Fabio's eye (ghosting); the still square box + swap LoRA replaced it. The swap LoRA is no
  longer swap-only: it locks H3's timing to the source for every masked edit.
