# MPI-1232 footprint map (read-only sweep, master @ 41ca1dbc6, 2026-10-22)

Line numbers drift - grep the symbol before trusting a number. Ignore `.claude/worktrees/peaceful-hawking-cf139e` hits (stale).

## A. Graphs

- Raw LiteGraph = the only editable copy: `comfy_workflows/raw/*.json`. `scripts/sync-raw-workflows.mjs` turns
  `raw/<x>_template.json` -> `comfy_workflows/scripts/workflow_generation/<x>_template.json` -> `orchestrate.py`
  (`registry.py:19-49`) -> `generate_<family>.py` -> runtime; a bare `raw/<x>.json` becomes runtime directly.
  Docs: `comfy_workflows/scripts/workflow_generation/README.md`, `docs/playbooks/add-model/01-workflow-split.md`,
  `docs/playbooks/common/workflow-authoring-entry.md:12-35`. No generator touches tile/grid nodes.
- Raw sources with a "Tile Upscale" group: krea2/flux3 (one minified line each), moss, klein, chroma, sdxl
  `_t2i_template.json`, `qwen_image_2_1.json`.
- 14 runtime: krea2_t2i_sfw/nsfw, flux3_t2i, moss_t2i, klein_t2i, klein_9b_t2i, chroma_t2i, chroma_hyper_t2i,
  t2i_sdxl_realistic, t2i_sdxl_nsfw, t2i_ill_anime, t2i_ill_anime_beauty, t2i_pony_mix, qwen_image_2_1.

| graph | MakeTileSEGS | tile DetailerForEachPipe | Input_Tile_Upscale | Input_Auto_Grid | Input_Upscale_Factor |
|---|---|---|---|---|---|
| krea2 sfw/nsfw | 719 | 717 ("Tile detailer (Klein 9B)" - wrong title) | 740 | 649 | 632 |
| flux3, moss, klein, klein_9b | 684 | 685 | 686 | 395 | 397 |
| chroma, chroma_hyper | 2779 | 2780 | 2781 | 2754 | 2737 |
| qwen_image_2_1 | 117 | 119 | 121 | 93 | 92 |
| 5 SDXL-family | 1748 | 1749 | 1750 | 1698 | 1694 |

All bake bbox 1024 / min_overlap 200 / crop 1.5 / filter dil 30 / irregularity 0.7 "Reuse fast" / guide 1024 / max
1536 / wildcard "". Krea2: ImageScaleBy 720 feeds 719; pipe 734 positive = 732 CLIPTextEncode(114 whole prompt);
steps 725, cfg 726 wired. flux3: pipe 674 positive = 681 CLIPTextEncode(93 Input_Positive), negative ZeroOut; cfg
baked 1. Input_Tile_Upscale -> BooleanInvert -> MpiIfElse (true = USDU, false = tile detailer).
Grid is upscale-only: Input_Auto_Grid -> MpiGridDimensions -> USDU tile w/h; off = one-pass USDU (stays as the
non-tile path). No shipped graph has a detector in the tile group (only `img_auto_mask.json:34`).
Injection (`comfyController.js`): plain keys 1706-1718 (no bbox_size/wildcard/min_overlap in the list);
`Title.widget` dotted keys 1729-1753 (MPI-359); naming law `.claude/rules/comfy_injection.md:10`; detector model
path kept as `bbox/...` forward slashes 1800-1806 (MPI-246).

## B. App code

- `PromptBoxControls.js`: imports tileCount :28; `useGrid` 764-815 (emits/listens `promptbox:upscale-split`);
  `useTiles` 817-869 (shared scope, injects Input_Tile_Upscale :867); `upscaleFactor` 871-966 (options 885, label
  "Upscale · N tiles" 903-906, re-mount on split event 933-942, setInputImage 945-953); gate `capabilities.tileUpscale`
  2185-2187. Callers MpiPromptBox.js:653, :2442.
- `promptControlDefaults.js`: useGrid :22, useTiles :25, upscaleFactor 1.5 :26.
- `commandRegistry.js`: upscale help :461 ("WHOLE prompt", 1024 px), components :479, enlarges :472.
- `generationControls.js`: UPSCALE_FACTORS :381, modelShowsTiles 384-386, namedParamsFor 269-272,
  resolveNamedParams :536, tile block 697-723 (`Input_Auto_Grid = !tilesOn && opSaved.useGrid` :710).
- `tileCount.js`: tileCount(w,h,factor,{bbox=1024,overlap=200,irregularity=0.7}); runTileCount reads only
  Input_Tile_Upscale + Input_Upscale_Factor. Used by commandExecutor.js `_tileStages` 377-383 (stage total :2115),
  agentDispatch.js:981 (quote), the label.
- `promptReuse.js:463-469`: reads DEAD keys `Auto_Grid` / `Upscale_Factor` (runs inject `Input_` names);
  `MpiGalleryBlock.js:1648-1656` checks dead `injectionParams.Auto_Grid`.
- `models.js`: `capabilities.tileUpscale: true` on 14 models (94,170,250,330,410,486,600,692,828,1016,1160,1898,2052,2189).
- Agent: agentDispatch.js:292/300 (named tiles, upscaleFactor), 977-1005 quote; agentLoop.mjs:122-123 schema,
  :1115, :2500, `_SENT_KEYS` :3555, `_tilesNote` 3619-3630; routes/mcp.js:495-496; connector.js NAMED_PARAM_KEYS :467
  (602-622, 670, 782); routineModel.js `_MODEL_NAMED_KEYS` :36 (validated 297-302); routineDispatch.js:95.
- Progress: progressStages.js:111 stale `'krea2_t2i.json': {postTile: 1}` (refiner deleted -> +1 bar every Krea2 tile
  run); progressAggregator.js:77-86 classes DetailerForEach/Debug but NOT DetailerForEachPipe.
- Tests pinning today: tests/agent-tiles.test.cjs (Grid 38-60; regex pins 76-82 incl. "WHOLE prompt"; docs pin
  88-110), tests/tile-count.test.cjs (exact counts), tests/desktop/prompt-box-use-tiles.spec.js (Grid/Tiles
  exclusivity, "8 tiles"/"6 tiles"), agent-loop.test.cjs:895-912,1970, tile-post-pass-stage.test.cjs:105,
  upscale-limit.test.cjs:44. No test reads the tile graph shape.

## C. Describer

- `llmService.js` describeImage :1129 - endpoint (POST /llm/describe, crop server-side routes/llm.js:545-611; queued
  via describeExecutor.js) vs comfy (`imageDescribe`, `buildDescribeInjectionParams` 1083-1088; **crop IGNORED**).
- `image_descriptor.json`: 43 Input_Image -> 41 ScaleToTotalPixels 1 MP; 35 CLIPLoader qwen3vl 4B; 38
  Input_Describe_Prompt -> 36 TextGenerate (512, temp 0.2) -> 48 MpiClearVram -> 37 Output_prompt.
- Make seamless prior art: flowsRegistry.js:1948-2021 (describe everyPass :2017-2019), services/seamlessOps.js
  (physical window PNGs via /seamless/prepare + /seamless/window), flowPasses.js `_seamlessPlanner` 159-227,
  flowService.js 704-720 (describe -> queue -> paste per window; progress flowStep i/N 677-679),
  flowEnhance.js describeAsks 425-437, stageBoxCrop 464-485 (works on both backends), describeFlowRun 524-592.

## D. Docs/rules naming Tiles or Grid

docs/models/krea2/upscaling.md (20-43 shape, 79-96 traps, 100-103), krea2/README.md:48, krea2/injection.md:186,
qwen-image-2/README.md:18,23, docs/agent/upscaling.md (13-15, 20, 42-50; pinned by agent-tiles.test),
agent/models/flux-3.md:44 (WRONG: flux3 tile pipe does take Input_Positive), agent/models/moss-image.md:35,
agent-chat.md:77, generation-lifecycle.md:96, data.md:89, project-integrity.md:122,
playbooks/common/prompt-box-controls.md:19, add-flow/existing-flows/make-seamless.md:77, releases 2.1.0 :20 +
UNRELEASED :70, `.claude/rules` comfy_injection.md:85-86, component-comfy.md:21,158,205,246 (stale `Auto_Grid`),
component-state.md:69, component-events-blocks.md:95, state.md:81 (rules = ask Fabio first),
`.claude/skills/cubric-vision-generate/SKILL.md:73`, releaseNotes.js:94.

## E. Detectors

assetDeps.js: face-yolov8n 968-979 (`ultralytics/bbox/`, engineAsset, bakedOnPod), hand 980-990,
person-yolov8n-seg 991-1001 (`ultralytics/bbox/`, engineAsset, NOT bakedOnPod - Pod installs it at connect).
engineAssets install with the engine (routes/shared.js:1143-1155, resolveModelDeps.js:614-622); never declare per
model (flowsRegistry.js:990-999). Impact Subpack nodesDeps.js:143-148. The Subpack gives a SEGM detector only for a
model under `segm/` - from `bbox/` SegmDetectorSEGS dies on NO_SEGM_DETECTOR (stage 3 bench), so boxes it is.
