# MPI-800 Validation

Evidence is recorded here as each phase is verified.

## Phase 1 - code (2026-09-17)

- `node --test tests/comfy-stage-media.test.cjs` -> 6/6 pass (hardlink + reuse, new name after an
  edit, copy fallback on a forced EXDEV, input/ passthrough, ENOENT, route 200/404/400 + data-URL
  into `mpi_staged/`).
- Bites: `fs.link` swapped for `fs.copyFile` in `stageMediaFile` -> "a project file is hardlinked
  ..." FAILS (1 of 6); reverted, 6/6 again.
- 18 existing suites touching `comfyController` / `routes/comfy.js` (list in the session scratch
  `t1.txt`): `node --test ...` -> 123/123 pass.
- `npx eslint routes/comfy.js js/services/comfyController.js .../MpiSettings.js tests/comfy-stage-media.test.cjs` -> clean.
- Not yet live: the renderer change calls a route the RUNNING server does not have until the app
  restarts (Phase 2).

## Phase 2 - pin (2026-09-17)

- /mpi-nodes-sync drift check: node repo clean, HEAD == origin/main == `cff4c3b` (1.2.16); pin was `1de35a3`.
- `git -C ComfyUi-MpiNodes diff 1de35a3 cff4c3b -- __init__.py`: classes only ADDED (MpiLoadImage,
  MpiLoadVideoUpload, MpiLoadAudioUpload), none removed or renamed.
- `node_lock.json` pin -> `cff4c3b321f1eb9dc7403df8db6ed3ac5bd1e8fa` (from `git rev-parse`).
- `curl -L https://github.com/MadPonyInteractive/ComfyUi-MpiNodes/archive/cff4c3b3....zip` -> 521,047 bytes,
  98 entries, top folder `ComfyUi-MpiNodes-cff4c3b.../` (the lockUrl the installer builds resolves).
- Pending: Fabio restarts the app; then `.mpi_node_commit` + `/object_info` on 48188.

## Phase 3 (partial) + commit 1 (2026-09-17)

- raw/ conversion (34 files): guarded script (round-trip serialisation, no NEW link
  inconsistency, surviving nodes keep pos/size/mode). Dry-run convert of all 34 against the bench
  (8188, MpiNodes 1.2.16): every difference vs the committed API twins is intended.
- `validate-injection-rules.mjs` Upload check: passes converted flow_stems + klein; FAILS a copy
  with `audio = "bench_test.wav"` (exit 1) and the untitled donor nodes.
- `node --test "tests/**/*.test.cjs"` -> 1312 tests, 1305 pass, 6 fail - all six in the three
  test files held for commit 2 (workflow-media-slots, flow-required-media DramaBox,
  flow-model-choice draw-it-in), which assert the REBAKED runtime. Commit 1 carries the HEAD
  versions of those files, so its own suite is green.
- eslint (comfyController, MpiSettings), `node --check` (routes/comfy.js, both scripts),
  py_compile (registry.py, generate_h3.py) -> clean.
- Commit 1 = code + staging test + sync/validator + raw/ + generator comments + this card +
  MPI-800 board/events lines. Held for commit 2 (after Fabio's app restart + bake): node_lock pin,
  rebaked templates/runtime, the three runtime tests, the two comment-only test edits, all docs.

## Phase 2 engine + Phase 3 bake + commit 2 (2026-09-17)

- Engine restart: Fabio's app (now `%APPDATA%\Cubric Studio\logs\app.log`, MPI-708 rename) ran the
  boot drift repair at 15:38:25-27 — `installed=1de35a3 pinned=cff4c3b` -> pre-wipe, download,
  `node commit marker stamped`. The engine itself only starts on demand, so 48188 answered later:
  `/object_info/MpiLoadImage` (required `image` picker + `channel`, optional `string`, outputs
  `[image, mask, width, height, loaded]`) and `MpiLoadVideoUpload` (`loaded` last). 1.2.16 confirmed
  LIVE, not just on disk.
- A pre-restart run at 15:36 failed with `Media staging failed for Input_Video: HTTP 404`
  (MPI-771's GIF Remove background): the window had the new renderer from the tree while the server
  process predated `POST /comfy/stage-media`. Expected, restart-only.
- `gif_cutout_birefnet.json` (MPI-771, committed 1b55d284 AFTER commit 1, message d71d7044) folded
  into this card: the converter run with its SKIP cleared reports one DIRECT slot,
  `#1 MpiLoadVideo -> MpiLoadVideoUpload "Input_Video" picker=None block=true`, i.e. the same shape
  as its twin gif_cutout_sam3 (verified node-by-node). 35 raw files converted in total.
- Bake (research/bake.mjs, COMFY_URL=48188): 34 raw files -> 46 runtime + 11 template API files;
  `validate-injection-rules.mjs` passed all of them; `orchestrate.py` rebuilt every generated
  runtime. NB the raw list now comes from `ee034559^..ee034559` plus the worktree, since commit 1
  put raw/ in HEAD and the old `git diff` list would have been empty.
- `tests/workflow-media-slots.test.cjs` then failed on TWO shipped graphs the bake cannot reach:
  `ltx_video_upscale.json` (#10 MpiLoadVideo) and `remove_background.json` (#1
  MpiLoadImageFromPath) have NO `raw/` twin. Migrated by hand in API form (picker key added,
  `string: ""` kept, class swapped; output slot indices unchanged because the Upload node is a
  subclass); `validate-injection-rules.mjs` -> both conform. Recorded in media-inputs.md.
- `node --test "tests/**/*.test.cjs"` -> 1312 tests, 1311 pass, 0 fail (the 6 pre-bake failures,
  captured again before the bake, are gone).
- `research/survey.py`: no shipped graph carries a path loader, a checker on an injected path or an
  absolute path; the two remaining ABS hits are bench values in raw templates (ltx_i2v_t2v #608
  MpiString, minimax_h3_r2va #772 VHS_LoadVideoPath) which the bake scrubs/prunes.
- `verify-workflow.mjs` on all 46 changed runtime files against 48188 -> all validate (107
  uninstalled weights, not failures).
- `scripts/smoke-workflows.mjs --plan` -> clean, nothing rented: "every Mpi* class_type exists at
  MpiNodes cff4c3b3", "52 shipped graphs sweep clean". It also flags that `mpi-ci`'s pod
  `node_lock.json` is behind on MpiNodes (code-only node, no image rebuild) — a sibling-repo sync,
  NOT done here.
- Commit 2 = pin + rebaked templates/runtime + the two hand-migrated graphs + birefnet raw + the 5
  held test files + the doc rewrite + this card, through a private index (peers hold
  docs/agent-chat.md, dev_configs/smoke-run.txt, the MPI-702/706/774 cards and more).
- Commit 2 = b9f1d756, 84 files, pushed; CI run 35255413114 SUCCESS.
- `mpi-ci` pod lock synced to cff4c3b3 and pushed (ff426e2) — code-only node, no image rebuild.

## Phase 4 - live runs in Fabio's app (2026-09-17, local engine 48188, MpiNodes 1.2.16)

Scratch project `MPI-800 staging C` (session scratchpad), every submit `/connector/generate`
under `gpu_lease.py run`, every graph then read back from the ENGINE's `/history` so the
evidence is what ComfyUI executed, not what the app meant to send.

| check | result |
|---|---|
| krea2 `t2i` (seed image) | ok, 82s, `t2i_001.png` |
| krea2 `krea2Edit`, project-folder image — **hardlink** | ok, 77s. Staged `mpi_staged/ec7b60d1f23a6168.png` has **links=2**, same size as the source |
| krea2 `krea2Edit`, source on **D:** (other volume) — **copy** | ok, 78s. Staged `b07d74d96ff24025.png` has **links=1** — the copy fallback, live |
| krea2 optional slots empty | dispatched graph: `#553 Input_Image` string = the staged path, picker `None`; `#557 Input_Mask` and `#559 Input_Image_2` empty with `block_if_empty false` |
| klein-9b `kleinEdit`, ONE image | ok, 26s; `#474 Input_Image` staged, `#234/#235 Input_Image_2/3` and `#296 Input_Mask` empty. The surviving `#374 MpiAnyChecker` gates on node 93, not on an injected path |
| minimax-h3 `t2v_ms`, no frames (video, `loaded` gates) | ok, 111s, `t2v_001.mp4`; `#217 Input_Start_Frame` + `#219 Input_End_Frame` both empty |
| DramaBox flow, NO voice (audio gate) | ok, 37s, `flowDramaBox_001.flac`; `#11 MpiLoadAudioUpload` empty with `block_if_empty true` — the fork on `loaded` is what lets it run |
| Stems flow, real audio staged | ok; `#32 MpiLoadAudioUpload` string = `mpi_staged/6f8f55be93ea9eea.flac` |

Graphs the connector cannot dispatch (no model op, no Flow) were run straight on the engine with
the app's own `/comfy/stage-media` path injected (`research/graph_smoke.py`; no gallery card by
design): `remove_background.json` success 2s (the HAND-migrated one), `gif_cutout_birefnet.json`
success 28s, `gif_cutout_sam3.json` success 24s, `video_interpolate.json` success 4s.

NOT covered, and they need Fabio's eyes: reuse a card whose source was deleted (the
`input_asset_deleted` toast), adding a model folder with the engine running (the restart toast),
and `resize_video` on a clip with audio — its `MpiString` -> VHS + `MpiHasAudio` slot was
deliberately left alone by this card, so it is unchanged rather than untested.

LTX, Wan and Qwen could not run here: their weights are not installed on this box
(`/connector/models`), so their `loaded` gates are covered by the graph sweep and the rebake
only. The RunPod smoke at release covers them executing.

