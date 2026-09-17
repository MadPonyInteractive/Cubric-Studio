# MPI-800 research - Vision call sites and workflow survey (2026-09-17)

Survey script: `research/survey.py` (`python <it> [-v]`; reads every `comfy_workflows/*.json`,
`scripts/workflow_generation/*_template.json` and `raw/*.json`). Re-run it after the rewire;
it prints `LOADER-GATES=` and `ABS=` per file.

## Pin target

`ComfyUi-MpiNodes` `600c3782cd96dc7e1b182b055c3ff98e082fd8b2` = `chore: bump version to 1.2.15`,
on `origin/main` (checked with `git branch -r --contains`). Full sha from `git rev-parse`,
never expanded by hand.

## Engines today

| port | what | ComfyUI | MpiNodes |
|---|---|---|---|
| 48188 | app engine (`engine/ComfyUI_windows_portable`), no `--input-directory` flag, so input dir = `getComfyPath(ENGINE_ROOT, 'input')` | 0.34.0 | 1.2.12 (`.mpi_node_commit` = `1de35a3...`), `MpiLoadVideo` has no `loaded` output |
| 8188 | bench `G:\ComfyUi` | 0.34.2 | symlinked checkout, already has `loaded` |

## Code call sites

| site | today | verdict |
|---|---|---|
| `js/services/comfyController.js` media loop (`PATH_MEDIA_CLASSES`, ~line 1412-1466) | local: injects `_resolveMediaPath(val)` = absolute project/temp path | **breaks** under 1.2.13+. Stage into engine `input/` before injecting. Covers every Mpi loader, the `MpiString` fan-out (feeds `MpiHasAudio`) and `VHS_LoadVideoPath` (harmless to stage) |
| same loop, remote branch -> `_uploadRemoteMedia` -> `/remote/upload/media` -> wrapper `_land_on_volume` | writes `os.path.join(INPUT_DIR, base)` | **fine.** `mpi-ci/cubric-vision-pod/wrapper/wrapper.py`: `INPUT_DIR` and `ComfyManager.input_dir` both read `CUBRIC_INPUT_DIR`, and ComfyUI is spawned with `--input-directory self.input_dir`, so the upload lands in the Pod ComfyUI's real `input/`. Code-read only; a live Pod check is the RunPod smoke |
| `POST /comfy/stage-media-data-url` (`routes/comfy.js`) | writes `input/mpi_staged_<hash>.<ext>` | accepted as-is |
| `POST /comfy/stage-preview-latent` + `Video_Latent.load_path` | bare name in engine `input/` (or Pod upload) | unaffected |
| `reloadExtraPathsWhenReady` (`routes/comfy.js`) called from `POST /comfy/extra-folders` | POSTs `/mpi/reload-extra-paths` | route gone in 1.2.13; call already fails soft. Caller UI: `MpiSettings.js` `_saveExtraFolders` |
| `runGifCutoutTrack` (`commandExecutor.js`) | `Input_Video: payload.videoPath` (temp file) through `getEngine()` -> same media loop | covered by the loop fix |
| agent / connector dispatch (`js/shell/agentDispatch.js`, `generation.submit`) | renderer -> `comfyController` | covered |
| `routes/llm.js` describe image | sends a `data:` URL to an OpenAI-compatible model, not ComfyUI | unaffected |
| `MpiBrushTrain` / Brush install | no shipped workflow uses it; the splat flow is **MPI-623 (doing)** | out of scope here - message MPI-623 |
| `MpiJson*`, `MpiBatchTextReplace`, `MpiRandPromptGen*`, Upload loaders | not used by any workflow or generator | nothing to do |
| `scripts/smoke-workflows.mjs` | Pod-only; stages the probe image via `/remote/upload/media` | unaffected; it cannot run a LOCAL engine |

`scripts/engine-drift.mjs` `assessPinMove`: the MpiNodes diff 1de35a3..600c378 changes every
loader class, so the current `smoke-evidence.json` goes stale and `release:check` will want a
new RunPod smoke before the next release.

## Workflow survey (API JSON; raw twins match)

**Presence gates on a loader path** (`MpiString -> MpiAnyChecker -> loader.string`, checker
`has_value` -> gates). Rewire: loader.string <- the MpiString, gates <- loader `loaded`, delete
the checker. `has_to` empty = checker is a dead pass-through, just remove it.

| raw source | checker ids (has_value consumers) | runtime twins |
|---|---|---|
| `boogu_edit_template` | 229 (208, 226) | boogu_edit_balanced / _high |
| `chroma_t2i_template` | 2705 (none) | chroma_t2i, chroma_hyper_t2i |
| `sdxl_t2i_template` | 1637 (none) | 5 x t2i_* |
| `klein_t2i_template` | 231 (138, 182), 232 (201), 297 (576, 592, 656) | klein_t2i, klein_9b_t2i |
| `krea2_t2i_template` | 544 (405, 407, 562.b), 551 (576, 594) | krea2_t2i_sfw / _nsfw |
| `qwen_edit_template` | 186 (none), 187 (none), 196 (256, 265, 272 MpiBlocker) | qwen_edit |
| `ltx_i2v_t2v_template` | 504 (553.a, 594.a), 507 (316, 318, 327, 328, 338, 349, 553.b) | ltx_i2v_t2v, _int8 |
| `wan22_i2v_template` | 899 (918.a, 946), 902 (918.b) | wan22_i2v |
| `flow_drama_box` | 14 (15) - loader #11 `block_if_empty: true` | flow_drama_box |

Checkers on TEXT (`MpiText` negatives/positives: klein 374, ltx 625/629) are not loader gates
and stay. `flow_outpaint` raw 665 is a muted checker; pruned, leave it.

**Behaviour change to accept:** a gate wired to `loaded` forces the loader to execute even on
the empty arm (it used to be skipped lazily). Cheap: an empty path returns at once. DramaBox's
`tests/flow-required-media.test.cjs` exemption is written around the old laziness and must be
rewritten (loader #11 then consumes `Input_Audio` directly).

**Baked absolute paths on LIVE nodes** (clear to `""`): `flow_head_swap` 79, 81 ·
`flow_ltx_extend` 17 · `flow_ltx_foley` 17 · `img_auto_mask` 1630 · `nvidia_pid` 1626 ·
`seedvr2_video` 125 · `krea2_t2i_template` 553 (the generator already clears it in the
runtime). Muted bench nodes (`ltx_i2v_t2v_template` 608, `minimax_h3_r2va_template` 772,
`LoadImage` helpers) are pruned and left alone. `raw/ltx_v2v_lipdub_template.json` has no
handler and no runtime twin (paths point inside the bench `input/`) - not shipped, left alone.

**No change needed** (loaders only, `loaded` appended last so indices hold): flow_chatter_box,
flow_draw_it_in, flow_h3_extend, flow_object_stamp, flow_outpaint, flow_scribble, flow_stems,
flow_voice_changer, gif_cutout_sam3, image_descriptor, image_upscale, ltx_video_upscale,
minimax_h3_fl2va / r2va (sentinel-based, no checkers; `generate_h3.py` comments still say
"MpiAnyChecker" - stale), remove_background, resize, resize_video (`MpiHasAudio`),
seedvr2_image, video_interpolate, video_upscale, wan5b_i2v / t2v. No Upload node anywhere.

## Docs that state the old contract

`docs/workflow-authoring/media-inputs.md` (rule: "no input/ staging"; path source law;
presence routing via `has_value`), `docs/workflow-authoring/mpi-nodes.md`,
`docs/playbooks/add-flow/02-media-io.md`, `docs/playbooks/add-flow/existing-flows/drama-box.md`,
`docs/playbooks/add-model/01-workflow-split.md`. Rule file needing permission:
`.claude/rules/comfy_engine.md:353` (names the removed route).
