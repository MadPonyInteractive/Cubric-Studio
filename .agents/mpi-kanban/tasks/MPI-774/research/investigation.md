# MPI-774 research - investigation for the large plan (2026-09-15)

Four read-only investigators (connector tools, LLM/settings, describe path, chat UI) plus
spot checks in the planning session. **Only what the planning session re-read is listed as
fact here.** Line numbers are as of `718e29bf` and rot; cite by symbol when reusing.

## Investigator claims that were WRONG - do not reuse

1. "No server-side ComfyUI dispatch exists." `ComfyUIEngine` (`services/llmEngines.mjs:486-629`)
   POSTs `/prompt` and polls `/history`. It is harness-shaped (a minimal 4-node graph, a local
   base URL, no engine split), so it is still NOT the path for `look`.
2. "`image_descriptor.json` node 38 is injectable." It is `PrimitiveStringMultiline` titled
   `Text String (System Prompt)`, holding a hand-rolled ChatML system prompt. The only
   injectable node is 43, `Input_Image`.
3. "`MpiLlmSettings` is in `Compounds/LandingPages`" / "in `Blocks/MpiRemote`". It is
   `js/components/Organisms/MpiLlmSettings/` (moved by MPI-751).
4. "No `EventSource` consumer in the renderer." `js/shell/agentDispatch.js:333` subscribes to
   `/connector/jobs/stream`.
5. "`docs/agent/` does not exist." It holds `gallery.md`, `prompt-enhancement.md`,
   `runpod-setup.md`.
6. "Video medium = `4k`." Tier ids are per model type in `js/utils/ratios.js`
   (`very_low`, `low`, `medium`, `high`, ...); `medium` exists.
7. "Enter/Shift+Enter is handled by MpiInput emitting input." `MpiInput.js:146` commits and
   blurs on Enter for single-line inputs; `MpiPromptBox`'s own textarea keydown (`:1446-1459`)
   handles Enter only while the @-reference picker is open. Cue is Ctrl+Enter.

## Verified facts

### Connector (`routes/connector.js`, `js/shell/agentDispatch.js`)

- Routes: `GET /connector/capabilities` (:165), `GET /connector/jobs/stream` (:175),
  `POST /connector/generate` (:219), `POST /connector/open-project` (:294),
  `POST /connector/jobs/:id/result` (:316). No auth middleware.
- `_dispatchToRenderer` (:106) writes one SSE `job` frame to the newest subscriber and holds the
  caller's HTTP request until the renderer reports. `JOB_TIMEOUT_MS` = 30 min (:90); on expiry
  the caller gets `TIMEOUT` while the generation keeps running in the app.
- Named params: `NAMED_PARAM_KEYS` = ratio, qualityTier, turbo, styleSelect, stylization (:196),
  plus seed.
- Renderer `_submitGeneration` (agentDispatch :71): `NO_PROJECT` with no project open;
  `UNKNOWN_MODEL` when `getModelById(modelId)` misses; `OP_UNAVAILABLE` via
  `isOperationInstalled`; `MASK_UNSUPPORTED`; media via `resolveAgentMedia` (MPI-765).
  Output `{itemId, groupId, type, filePath, seed, pixelDimensions, generationMs}` (:168-179);
  a text op reports `{text}` through `onText` (:181).
- `_submitFlow` (:211) resolves declared fields only, via `resolveFlowFieldValues` (:252). A
  step `param` (Head Swap `box1`/`box2`) has no input path.
- `resources/cubric/connector-manifest.json` advertises `project.context.read`,
  `asset.import`, `generation.submit`, `system.memory.release`. Only `generation.submit` is
  served (open-project is served and not listed). `assertConnectorManifest`
  (`scripts/build-portable.mjs:691`) REQUIRES `system.memory.release`; the file is hashed at
  :831. Consumers, grepped in Vision and `../Cubric-Studio`: `build-portable.mjs`,
  `update-manifest.json`, `update-manifest.schema.json`. Nothing else.

### Describe

- `imageDescribe` (`js/data/commandRegistry.js:932`): one `inputImage` (`Input_Image`),
  `outputKind: 'text'`, `universal: true`.
- Right-click path (`js/utils/describeAction.js`): plugin gate `image-describer`
  (requiredDeps `qwen3vl-abliterated-clip`, :47) then `enqueueGeneration({ operation:
  'imageDescribe', model: { id: null }, injectionParams: {} })` (:55-63), result via `onText`.
  So a question injects through generic `injectionParams` once a node carries an `Input_*`
  title; no `commandExecutor.js` edit is implied.
- Graph: 35 CLIPLoader `qwen3vl_4b_abliterated_fp8_scaled`; 36 TextGenerate (thinking false,
  use_default_template true, temperature 0.2, max_length 512); 37 PreviewAny `Output_prompt`;
  38 system prompt; 41 ImageScaleToTotalPixels 1 MP; 43 MpiLoadImageFromPath `Input_Image`;
  48 MpiClearVram.
- Head Swap (`comfy_workflows/flow_head_swap.json`): node 90 MpiBox `Input_Box`
  `{width, height, x, y}` baked 360/360/200/200; node 88 `Input_Box_2` 1024/1024/0/0.
  Consumers MpiBoxMask 91, MpiBoxCrop 89, MpiFromBox 285. Pixels on the source image.
- `sharp` ^0.34.5 is a dependency. `services/imageCrop.js` exports `cropExtended`,
  `planExtendedCrop`, `parseFill`.

### LLM, secrets, settings, hardware

- `DeepInfraEngine` (`services/llmEngines.mjs:332`): `constructor(apiKey, baseUrl)`,
  `resolveBaseUrl()` honours `CUBRIC_OPENAI_BASE_URL`; `chat()` (:356) sends
  model/messages/`stream: false` and sampling options; no `tools`, returns text only.
  `MODEL_REGISTRY` has no context-window field.
- `main/secretsStore.js`: ONE DeepInfra slot, set/has/get/clear (:163-189); IPC exposes
  set/has/clear only (:238-240); the server reads it through the fork bridge. No named slots.
- `MpiLlmSettings`: per-job rows; the header (:43-44) reserves a third Agent row; `BACKENDS`
  deepinfra/ollama/comfy (:71-75); preferences in localStorage `cubric.llm.*`.
- `GET /system/gpu-info` (`routes/system.js:153`) returns `{gpu:{name,vendor,arch}, vramTotal,
  ramTotal}`. Pod capacity: `routes/remotePodLifecycle.js:1331-1380` `{gpuName, vramGb, ramGb}`.
- `services/agentCorpus.mjs` imports `js/data/*` from Node (:25-28), exports `AGENT_DOCS_DIR`
  and `listCorpus()` -> `[{id, kind, title, tags, text()}]` including `app:operations`.
- Installed state: `POST /comfy/models/check` (`routes/comfy.js:884`) takes a payload that
  `js/data/modelRegistry.js` builds in the renderer; that module imports
  `remoteEngineClient` and `Events`, so it is not importable server-side as it stands.
- Install: `POST /comfy/models/download/start`, `GET /comfy/downloads/status`,
  `GET /comfy/downloads/stream` (`routes/downloadManager.js` header).
- Routers mount in `server.js:48-87`.

### UI

- `MpiPromptBox` textarea is an `MpiInput` mount (:1311).
- Landing has no PromptBox; `js/shell/projectUI.js` is hand-built. MPI-766 (todo, blocked)
  rebuilds it in `projectUI.js`, `heroQuote.js`, `styles/shell/landing.css`.
- Mascot is a plain `<img>`: `MpiGalleryGrid.js:1528-1530` (idle/greet/waiting),
  `MpiGroupHistoryBlock.js:459` (waiting, float keyframe).
- New component checklist: css in `js/shell/preloadStyles.js`, props in
  `js/components/types.js` (`.claude/rules/components.md:64,74-75`).

## Probe - orchestrator smell test (2026-09-15, ~15:30Z)

Command (key into the process env only):

```bash
export DEEPINFRA_API_KEY="$(cat /c/Users/Fabio/.secrets/di.txt | tr -d '\r\n')" && node probe-orchestrator.mjs
```

The script (session scratchpad, expires) offers two tools, `list_models` and `generate`
(`qualityTier` enum low/medium/high, `turbo`), a system prompt saying "Mode: Auto. For video
use qualityTier medium and turbo true without asking", and the user turn "Make me a 5 second
video of a fox running through snow."

| Variant | Result |
|---|---|
| default | 200, finish `tool_calls`, `list_models {}`, reasoning_tokens 0, 2.0 s, 472 in / 29 out, $0.000034 |
| `chat_template_kwargs: {thinking: false}` | same call, reasoning_tokens 0, 1.5 s, 256 cached, $0.000022 |
| `reasoning_effort: "none"` | same call, reasoning_tokens 0, 2.6 s, $0.000022 |
| round 2, after a fake `list_models` result | `generate {model: ltx-2.3, op: t2v, qualityTier: medium, turbo: true, prompt: "A red fox running through deep snow..."}`, zero questions, 3.1 s, $0.000052 |

- `deepseek-ai/DeepSeek-V4-Flash-0731` is listed in `/v1/openai/models`.
- DeepInfra returns `usage.prompt_tokens`, `cached_tokens` and `estimated_cost`: enough for the
  compaction trigger and cost per session without a tokenizer.
- **Limits:** one scenario, one run per variant. Criteria 1-2 smell-tested only; the 3/3
  harness in the plan is the gate.
