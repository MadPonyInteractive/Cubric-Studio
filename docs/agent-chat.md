# Agent chat — the in-app agent contract (MPI-774, slice A)

An Agent | Prompt toggle turns the prompt box into a chat with a **server-side** loop that recommends
and installs models, generates through the connector, sees images through the describer, and compacts
itself. Spec: `.agents/mpi-kanban/tasks/MPI-774/brief.md`. Contract first (2026-09-15), kept current.

## Shape

- **Loop** `services/agentLoop.mjs`, mounted by `routes/agent.js`. One session, in server memory.
- **Tools are connector routes.** `services/agentTools.mjs` is a fetch table over loopback, so a
  CLI agent (MPI-593) gets the same surface. No second dispatch path (`routes/connector.js` header).
- **Chat** `js/components/Compounds/MpiAgentChat/`, twice: the landing slot (standalone, beside the
  headline) and a shell panel `#agent-panel-mount` (`js/shell/agentPanel.js`) LEFT of the workspace,
  open while `state.agentMode` is true (the PromptBox toggle, between the text field and Enhance).
  The panel pushes `#tool-container` right; the PromptBox sends with `agent:send`, its image chips
  as attachments. Each chat re-renders from `/agent/history` on mount (history `kind`, not `role`).
- **One stream.** `agentService.agentInitStream()` (shell boot) opens the only `/agent/stream` and
  re-emits every `agent:*` event on `Events`; chats, and the later mascot animations, subscribe there.
- **Keys** stay in `main/secretsStore.js`; the server reads them over the fork bridge
  (`routes/forkBridge.js` `ask`). The renderer can set, test and clear, never read.

Every route answers `{ ok: true, ... }` or `{ ok: false, error: { code, message } }`, the
connector's envelope. A malformed body is HTTP 400 `BAD_REQUEST`; everything else is 200.

## Brief items -> surface

| # | Brief item | Route / event / UI |
|---|---|---|
| 1 | Toggle, Enter sends, drop images, landing entry | `MpiPromptBox` toggle -> `state.agentMode`; shell panel; landing slot; `POST /agent/message` with `project: null` |
| 2 | Mascot always in the box | `idle.png` / `waiting.png` in `MpiAgentChat`, flipped by `agent:working` |
| 3 | Knows models, ops, fit, docs | `list_models` -> `GET /connector/models`; `read_knowledge` -> `GET /connector/knowledge[/:id]` |
| 4 | Recommends; VRAM<->RAM trade | `fit` on `GET /connector/models` (`footprint.js` `tradeTable`) |
| 5 | Installs only after a yes, size shown, verified | `agent:confirm` -> `POST /agent/confirm` -> `POST /connector/install` -> re-read `GET /connector/models` |
| 6 | Generates model ops + Flows, non-blocking | `generate` -> `POST /connector/generate` (not awaited) -> `agent:result` |
| 7 | Auto / Ask first | Agent row setting; `mode` on `POST /agent/message`; system prompt rules |
| 8 | Eyes = describer, question, crop | `look` -> `POST /connector/describe`; graph title `Input_Describe_Prompt` |
| 9 | Boxes for gizmo Flows | `look` with `box: true`; `params` on `POST /connector/generate` |
| 10 | Looks at each image result, never regenerates alone | loop runs `look` after an image `agent:result` |
| 11 | Fix advice | system prompt + `read_knowledge`; no tool (no History endpoint) |
| 12 | Prompt not shown | `agent:tool.label` never carries it; the UI never renders `args.prompt` |
| 13 | Honest limits, in character | limits list in the system prompt; `agent:message` |
| 14 | Memory while the app is open | server memory; `GET /agent/history`; `POST /agent/reset`; gone on restart |
| 15 | Auto-compact 50% / 30% at >= 1M | `usage.prompt_tokens` trigger; `agent:compacting`; handoff entry in history |
| - | Profiles, probe | Agent row in `MpiLlmSettings`; `POST /agent/probe`; fork-bridge message below |

## Tools (what the model sees)

JSON Schema `parameters`, OpenAI `tools` format. An invented tool is refused with `UNKNOWN_TOOL`.

| Tool | Parameters | Executes |
|---|---|---|
| `list_models` | `{}` | `GET /connector/models` |
| `read_knowledge` | `{ id?: string }` (no id = the index) | `GET /connector/knowledge[/:id]` |
| `install_model` | `{ modelId: string }` required | **never directly**: emits `agent:confirm`; `POST /agent/confirm` runs it |
| `generate` | `{ modelId?, operation?, flowId?, prompt?, negative?, ratio?, qualityTier?, turbo?, styleSelect?, stylization?, seed?, fields?: object, params?: object, media?: [{ role, image }] }` | `POST /connector/generate`, fired and not awaited |
| `look` | `{ image: string, question?: string, crop?: {x,y,width,height}, box?: boolean }`, `image` required | `POST /connector/describe` |
| `open_project` | `{ folderPath: string }` required | `POST /connector/open-project` |

- `image` / `media[].image` is a ref from the `_images` allowlist (this session's attachment ids,
  its own results' `filePath`s), **nothing else**: any other string is `IMAGE_NOT_FOUND`, never
  read off disk (the engine may be a remote Pod). An attachment is copied into the project with
  `POST /project-media/:id/place-preview-asset?folderPath=` **only when a generate uses it**; a
  result goes as `/project-file?path=`. `crop` and `box` are in ORIGINAL pixels.
- `generate` refuses by name before any spend when `project` is null: `NO_PROJECT`.

## Connector routes (W1, `routes/connector.js`)

**`GET /connector/models`** -> `{ ok, engine: 'local'|'remote', hardware: { gpuName, vramGb, ramGb },
models: [{ id, name, type, installed, ops: [{ op, installed, params: { ratios, qualityTiers, turbo,
styles } }], missingDownloadGb, fit: { floorVramGb, ramGbAtYourVram, runs } }], flows: [{ id, title,
operation, installed, fields: [id], boxParams: [{ param, role, ratio, overflow }] }] }`. `params` is
`generationControls.namedParamsFor`: exactly what `resolveNamedParams` accepts on that op
(`tests/agent-model-params.test.cjs`). Install state and ops come from the renderer relay; hardware
from `GET /system/gpu-info` locally, `GET /remote/pod/specs` when remote is active.
Errors: `APP_UNAVAILABLE`.

**`GET /connector/knowledge[/:id]`** -> `{ ok, entries: [{ id, kind, title, tags }] }` / `{ ok, id,
title, text }`. Source: `services/agentCorpus.mjs` `listCorpus()`. Errors: `UNKNOWN_ENTRY`.

**`POST /connector/install { modelId }`** -> `{ ok, modelId, downloadGb, started: true }`. Starts
the missing deps' download and returns; progress is `GET /comfy/downloads/status`. No gate here: a
CLI agent's user is its own gate. Errors: `BAD_REQUEST`, `UNKNOWN_MODEL`, `ALREADY_INSTALLED`,
`OFFLINE`, `APP_UNAVAILABLE`.

**`POST /connector/describe { imagePath, question?, crop? }`** -> `{ ok, output: { text, box? } }`.
`imagePath` absolute. A `crop` is cut with `sharp` to the agent dir first. No `question` = no
injection, so the graph runs today's caption instruction; a `question` injects a whole ChatML string
into `Input_Describe_Prompt` (the same wrapping precedent as `llmService.js` `Input_System_Prompt`).
Relayed as the universal text op `imageDescribe` with no model: `agentDispatch.js` gets a no-model
branch for universal text ops. `box` appears only when asked AND parsed; **the parser waits for
Phase 4's measured answers**. Errors: `BAD_REQUEST`, `IMAGE_NOT_FOUND`, `CROP_OUT_OF_BOUNDS`,
`DESCRIBER_MISSING` (the Image Describer plugin is not installed), `APP_UNAVAILABLE`,
`RUNTIME_ERROR`, `TIMEOUT`.

**`POST /connector/generate`, Flow `params`** — `{ flowId, fields?, media?, params?: { box1: { x, y,
width, height } } }`. Checked against the flow's `kind: 'box'` steps (`flowsRegistry.js`, read not
edited): known `param`, integers, square when the step has `ratio: 1`. **No bounds check** — the
resolved media carries no image size, and every shipped box step declares `overflow: 'allow'`
anyway; the first step without it needs the check built where the size is known (`sharp` on the
resolved url). Merged into `injectionParams`. Errors: `UNKNOWN_PARAM`, `INVALID_BOX`.

**`resources/cubric/connector-manifest.json`** lists what is served; `assertConnectorManifest`
(`scripts/build-portable.mjs`) asserts `generation.submit`, not the unserved `system.memory.release`.

## Agent routes (W2, `routes/agent.js`)

**`POST /agent/message { text, attachments?: [{ name, dataUrl }], project: { folderPath, name } | null,
mode: 'auto'|'ask', profileId, model? }`** -> `{ ok, turnId, attachments: [{ id, name }] }`, at once. The
reply arrives on the stream. `project` is the renderer's open project at send time; `profileId` is the
shared connection (`Storage.getLlmConnection()`), `model` the agent's pick (`''` = the preset's
recommended agent model). Errors: `BAD_REQUEST`, `NO_PROFILE`, `BUSY`; on the stream `NO_KEY`, `NO_MODEL`.

**`GET /agent/attachment/:id`** -> the staged file of THIS session's attachment id (history keeps only
`{ id, name }`); 404 for anything else, a result path included.

**`GET /agent/stream`** — SSE, `event: <name>` + `data: <json>`. Vocabulary below.

**`GET /agent/history`** -> `{ ok, working, pendingConfirm: {...} | null, usage: { promptTokens,
contextWindow }, entries: [{ id, at, kind: 'user'|'agent'|'tool'|'result'|'confirm'|'handoff',
text?, attachments?, tool?, args?, status?, output?, error? }] }`. Tool entries keep `args` for
tests; the UI shows them as status lines only.

**`POST /agent/confirm { confirmId, yes }`** -> `{ ok }`. Yes runs the install, then re-reads
`GET /connector/models` and reports what landed; No records "declined" as the tool result.
Errors: `UNKNOWN_CONFIRM` (stale or already answered).

**`POST /agent/reset`** -> `{ ok }`. Drops the session and the attachment dir.

**`POST /agent/probe { profileId, model? }`** -> `{ ok, tools: boolean, model, latencyMs, message }`.
The AGENT's check (can this model call a tool?): one tiny call carrying one tool, **never retried
without it**. Errors: `NO_PROFILE`, `NO_KEY`, `NO_MODEL`, `ENDPOINT_ERROR` (with `status`).

## SSE events (`/agent/stream`)

| Event | Data | UI |
|---|---|---|
| `agent:working` | `{ turnId, working: boolean }` | mascot `waiting.png` + float while true |
| `agent:message` | `{ turnId, id, text }` | one whole reply per model turn (D3) |
| `agent:tool` | `{ turnId, id, tool, status, label }`, status `started` / `done` / `failed` | status line; `label` is plain copy, never the prompt |
| `agent:confirm` | `{ turnId, confirmId, kind: 'install', modelId, modelName, downloadGb }` | Yes / No card |
| `agent:result` | `{ toolCallId, ok, output?: { itemId, groupId, type, filePath }, error? }` | result card, opens the card |
| `agent:compacting` | `{ turnId, on: boolean }` | "compacting" line + mascot |
| `agent:error` | `{ turnId, code, message }` | error line. Codes: `ENDPOINT_ERROR`, `NO_KEY`, `TOOLS_UNSUPPORTED`, `STEP_LIMIT` |

## Loop rules (W2)

- **System prompt:** role; mode (Auto: turbo on images, `medium` + turbo on video, where the op's
  `params` offer them; Ask first: ask about every setting); model rule (an installed op, else offer
  an install); settings rule (only values in `params`); looking rule (`look` before any comment on
  an image, only on attachment ids and own results; a refusal -> say so, suggest the local
  describer); installs always ask; the honest limits; the knowledge index.
- **App-state line** opens every user message: the open project by NAME (a shown path got looked
  at) or none, and "Images you can look at:" = the `_images` allowlist (the model had passed `look`
  the schema's words "result filePath"). A successful `open_project` updates the project for the
  rest of the turn; it only takes a path the USER gave.
- **Harness:** `npm run agent:test` (9 cases x 3, real model, fake tools from
  `tests/fixtures/agent/`; `--bite` proves each assertion, `--samples <md>` writes prompts to read).
- **Bounded steps:** at most 8 tool calls per user turn, then `agent:error STEP_LIMIT`.
- **Generate** is fired, not awaited. On settle: `agent:result`, the tool result is appended, and
  an image result gets a `look`. No regeneration on its own judgement.
- **Compaction:** after each response, when `usage.prompt_tokens >= contextWindow * (contextWindow
  >= 1_000_000 ? 0.30 : 0.50)`, the model writes a handoff (goal, decisions, cards generated, current
  model and settings, open question); the session restarts from system prompt + handoff + the last
  4 turns. No tokenizer.
- **Attachments** are staged in `<APP_USER_DATA>/agent/attachments/` (`os.tmpdir()/cubric-agent`
  when standalone), wiped at server start and on reset. Crops go to `.../agent/crops/`.

## The shared LLM connection (every Remote job; MPI-737 builds its rows on it)

A profile is a CONNECTION: `{ id, name, baseURL }` + a write-only key, in `main/secretsStore.js`.
Presets: DeepInfra (reuses the existing DeepInfra key slot), OpenRouter, OpenAI, Ollama `/v1`, custom.
The pick is ONE renderer pref, `Storage.getLlmConnection()`; each job keeps its own model
(`Storage.getAgentPrefs()` -> `{ model, mode }`). Settings: the connection block tops Remote >
Language Models; the Agent row is "Remote" + a model dropdown (recommended first) + mode + tool test.

- **A key is bound to the `baseURL` it was saved with**; an edited URL needs the key again.
  IPC `secrets:{list,save,delete}-endpoint-profile(s)`, `secrets:{set,has,clear}-endpoint-key`,
  **no get**. The server reads profile + key over the fork bridge (`get-endpoint-profile-request`).
- **`resolveConnection(profileId, ask)`** (`services/llmEngines.mjs`) is the one resolver: stored key,
  then `DEEPINFRA_API_KEY` for the `deepinfra` preset only while its URL is still DeepInfra's.
- **`POST /llm/connection/probe { profileId }`** -> `{ ok, latencyMs, modelCount }` (a `GET /models`,
  no tokens). **`GET /llm/connection/models?profileId=`** -> `{ ok, profileId, models: [{ id,
  contextWindow, vision, recommendedFor[] }] }`, recommended first; a tagged catalogue (DeepInfra) is
  cut to `chat` models. Errors `BAD_REQUEST` (400), `NO_PROFILE`, `NO_KEY` (not for `ollama`),
  `ENDPOINT_ERROR` + `status`. Tests: `tests/llm-connection.test.cjs`.
- **`RECOMMENDED_REMOTE_MODELS`**: `{ [presetId]: [{ id, jobs: ('agent'|'enhance'|'describe')[],
  contextWindow? }] }`, exact ids, no cross-provider matching. MPI-774 fills `agent`.
- **The agent's context window** (compaction): that table, else the endpoint's own entry (cached for
  the session), else `FALLBACK_CONTEXT_WINDOW` (32,768, conservative).
- **`DeepInfraEngine.chat`** forwards `tools` and returns `toolCalls` and `usage` beside `text`.

## `look` coordinates

The describer sees the crop (if any) scaled to ~1 MP (`image_descriptor.json` node 41,
`ImageScaleToTotalPixels`, 1 MP, steps of 16). A point in that input space maps back as
`x_orig = crop.x + x_in * crop.width / inputWidth` (same for y; no crop = the whole image). W1
ships this as a pure function with a round-trip test; the answer's raw format and space
(pixels of the scaled input, or 0-1000 normalised) are chosen from Phase 4's recorded answers.
