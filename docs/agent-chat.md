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
  420 px, below the topbar, open while `state.agentMode` is true (the PromptBox toggle). It pushes
  `#tool-container` right; the PromptBox sends with `agent:send`, image chips as attachments. Each
  chat re-renders from `/agent/history` on mount; a result card emits `gallery:open-card`, and the
  shell opens that card's history when the open project holds it.
- **One stream.** `agentService.agentInitStream()` (shell boot) opens the only `/agent/stream` and
  re-emits every `agent:*` event on `Events`; chats, and the later mascot animations, subscribe there.
- **Keys** stay in `main/secretsStore.js`; the server reads them over the fork bridge
  (`routes/forkBridge.js` `ask`). The renderer can set, test and clear, never read.
- **Envelope:** `{ ok: true, ... }` or `{ ok: false, error: { code, message } }`, the connector's.
  A malformed body is HTTP 400 `BAD_REQUEST`; everything else is 200.

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
| 14 | Memory while the app is open; per-project notes after it | server memory, `GET /agent/history`, `POST /agent/reset`; `<project>/Agent/` via `read_memory` / `write_memory` |
| 15 | Auto-compact 50% / 30% at >= 1M | `usage.prompt_tokens` trigger; `agent:compacting`; handoff entry in history |
| - | Profiles, probe | Agent row in `MpiLlmSettings`; `POST /agent/probe`; fork-bridge message below |

## Tools (what the model sees)

JSON Schema `parameters`, OpenAI `tools` format. An invented tool is refused with `UNKNOWN_TOOL`.

| Tool | Parameters | Executes |
|---|---|---|
| `list_models` | `{}` | `GET /connector/models` |
| `read_knowledge` | `{ id?: string }` (no id = the index) | `GET /connector/knowledge[/:id]` |
| `install_model` | `{ modelId: string }` required | **never directly**: emits `agent:confirm`; `POST /agent/confirm` runs it |
| `generate` | `{ modelId?, operation?, flowId?, prompt?, negative?, ratio?, qualityTier?, turbo?, styleSelect?, stylization?, seed?, cardName?, fields?: object, params?: object, media?: [{ role, image }] }` | `POST /connector/generate`, fired and not awaited; a model op waits for its guide (below) |
| `look` | `{ image: string, question?: string, crop?: {x,y,width,height}, box?: boolean }`, `image` required | `POST /connector/describe` |
| `open_project` | `{ folderPath: string }` required | `POST /connector/open-project` |
| `rename_card` | `{ groupId, name }` required | `POST /connector/rename-card`, only a card this session generated (`UNKNOWN_CARD`) |
| `read_memory` / `write_memory` | `{ file? }` / `{ file, title, text, hook? }` | `/connector/memory` for the OPEN project only (`NO_PROJECT`) |

- **Never deletes** (Fabio, 2026-09-16): no tool deletes, and `agentTools.mjs` reaches an
  allowlist of routes (`tests/agent-no-delete.test.cjs`, which bites on a new tool or route).
  Outside agents (CLI, the skills) keep the delete routes: that is their user's call.
- `image` / `media[].image` is a ref from the `_images` allowlist (this session's attachment ids,
  its own results' `filePath`s), **nothing else**: any other string is `IMAGE_NOT_FOUND`, never
  read off disk (the engine may be a remote Pod). An attachment is copied into the project with
  `POST /project-media/:id/place-preview-asset?folderPath=` **only when a generate uses it**; a
  result goes as `/project-file?path=`. `crop` and `box` are in ORIGINAL pixels.
- `generate` refuses by name before any spend when `project` is null: `NO_PROJECT`.

## Connector routes (W1, `routes/connector.js`)

**`GET /connector/models`** -> `{ ok, engine: 'local'|'remote', hardware: { gpuName, vramGb, ramGb },
models: [{ id, name, type, installed, ops: [{ op, installed, params: { ratios, qualityTiers, turbo,
styles }, media: [{ role, type, required, tag? }] }], missingDownloadGb, fit: { floorVramGb,
ramGbAtYourVram, runs }, guides: [id] }], flows: [{ id, title, operation, installed, fields: [id],
boxParams: [{ param, role, ratio, overflow }] }] }`. `params` = `generationControls.namedParamsFor`
(`tests/agent-model-params.test.cjs`); `media` = the op's `mediaInputs` through
`filterMediaInputsForModel` (`mediaRolesFor`); `guides` = `agentCorpus.guideIdsByModel()`. Install
state and ops come from the renderer relay; hardware from `GET /system/gpu-info`, or
`GET /remote/pod/specs` when remote is active. Errors: `APP_UNAVAILABLE`.

**`GET /connector/knowledge[/:id]`** -> `{ ok, entries: [{ id, kind, title, tags }] }` / `{ ok, id,
title, text }` from `agentCorpus.listCorpus()`: recipe briefs (`model`), our prompting guide per
recipe (`guide`, `docs/agent/models/<recipeId>.md`), the Cubric Vision skills (`skill`, read from
`.claude/skills/cubric-vision*`; `copyAgentSkills` stages them in `docs/agent/skills/` for the
portable build, which excludes `.claude`), and `docs/agent/*.md` (`app`). Errors: `UNKNOWN_ENTRY`.

**`GET /connector/memory[/:file]?folderPath=`** -> `{ ok, notes: [{ title, file, hook }] }` /
`{ ok, file, text }`; **`POST /connector/memory { folderPath, file, title, text, hook? }`** ->
`{ ok, file, created }` (`services/agentMemory.mjs`). `<project>/Agent/README.md` indexes one
`<slug>.md` per note; a file is a lowercase slug, so it cannot leave that folder. No delete route.
Errors: `BAD_REQUEST` (400), `NOT_A_PROJECT`, `UNKNOWN_NOTE`, `NOTE_TOO_LONG` (4 KB), `MEMORY_FULL` (100).

**`POST /connector/install { modelId }`** -> `{ ok, modelId, downloadGb, started: true }`. Starts
the missing deps' download and returns; progress is `GET /comfy/downloads/status`. No gate here: a
CLI agent's user is its own gate. Errors: `BAD_REQUEST`, `UNKNOWN_MODEL`, `ALREADY_INSTALLED`,
`OFFLINE`, `APP_UNAVAILABLE`.

**`POST /connector/describe { imagePath, question?, crop? }`** -> `{ ok, output: { text, box? } }`.
`imagePath` absolute; a `crop` is cut with `sharp` to the agent dir first. No `question` = today's
caption instruction. Relayed as `agent.describe` to `llmService.describeImage`, which runs the user's
Image descriptions pick ([llm.md](llm.md)); `box` waits for Phase 4's measured answers. Errors:
`BAD_REQUEST`, `IMAGE_NOT_FOUND`, `CROP_OUT_OF_BOUNDS`, `DESCRIBER_MISSING` (ComfyUI, no Image Describer
plugin), the Remote codes (`NO_KEY`, `NOT_VISION`, ...), `APP_UNAVAILABLE`, `RUNTIME_ERROR`, `TIMEOUT`.

**`POST /connector/generate`, Flow `params`** `{ box1: { x, y, width, height } }`: checked against
the flow's `kind: 'box'` steps (known `param`, integers, square when `ratio: 1`), merged into
`injectionParams`. No bounds check: media carries no size, and every shipped box step declares
`overflow: 'allow'`. Errors: `UNKNOWN_PARAM`, `INVALID_BOX`.

**`resources/cubric/connector-manifest.json`** lists what is served; `assertConnectorManifest`
(`scripts/build-portable.mjs`) asserts `generation.submit`, not the unserved `system.memory.release`.

## Agent routes (W2, `routes/agent.js`)

**`POST /agent/message { text, attachments?: [{ name, dataUrl }], project: { folderPath, name } | null,
mode: 'auto'|'ask', profileId, model? }`** -> `{ ok, turnId, attachments: [{ id, name }] }` at once; the
reply comes on the stream. `project` = the renderer's open project; `profileId` = the shared connection;
`model` = the agent's pick (`''` = the preset's). Errors: `BAD_REQUEST`, `NO_PROFILE`, `BUSY`; on the stream `NO_KEY`, `NO_MODEL`.

**`GET /agent/attachment/:id`** -> the staged file of THIS session's attachment id; 404 for anything
else. **`GET /agent/stream`**: SSE, `event: <name>` + `data: <json>`, vocabulary below.

**`GET /agent/history`** -> `{ ok, working, pendingConfirm: {...} | null, usage: { promptTokens,
contextWindow }, entries: [{ id, at, kind: 'user'|'agent'|'tool'|'result'|'confirm'|'handoff', text?,
attachments?, tool?, args?, status?, output?, error? }] }`. The UI shows tool entries as status lines.

**`POST /agent/confirm { confirmId, yes }`** -> `{ ok }`. Yes installs, then re-reads the models and
reports what landed; No records "declined". Errors: `UNKNOWN_CONFIRM` (stale or answered).

**`POST /agent/reset`** -> `{ ok }`. Drops the session and the attachment dir.

**`POST /agent/probe { profileId, model? }`** -> `{ ok, tools: boolean, model, latencyMs, message }`.
Can this model call a tool? One tiny call with one tool, **never retried without it**. Errors:
`NO_PROFILE`, `NO_KEY`, `NO_MODEL`, `ENDPOINT_ERROR` (with `status`).

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
  `params` offer them; Ask first: ask about every setting); model, settings, looking, guide,
  install, project, deletion, memory and naming rules; the honest limits; the knowledge index.
- **Opening lines** of every user message: the app state (the open project by NAME, a shown path got
  looked at; "Images you can look at:" = the `_images` allowlist), then the project's notes index
  once per project (first turn, a switch, after a compaction), then what finished since the last
  turn. A successful `open_project` updates the project for the rest of the turn (its result
  carries the new project's notes); it only takes a path the USER gave.
- **Guide gate:** a model op's `generate` answers `GUIDE_NOT_READ` until this context has read one of
  that model's `guides` with `read_knowledge` (a Flow is not gated). The H3 samples showed a rule
  alone did not make the model read one. A compaction clears what was read.
- **Harness:** `npm run agent:test` (13 cases x 3, real model, fake tools; `--bite` proves each
  assertion, `--samples <md>` writes prompts to read).
- **Bounded steps:** at most 8 tool calls per user turn, then `agent:error STEP_LIMIT`.
- **Generate** is fired, not awaited. On settle: `agent:result`, a queued "[Generation finished:
  card <groupId> ...]" (or failed) line for the next turn, and an image gets a `look`, queued too: a
  message pushed mid-turn could split a tool call from its result. No regeneration on its own.
- **Compaction:** when `usage.prompt_tokens >= contextWindow * (window >= 1M ? 0.30 : 0.50)`, the model
  writes a handoff (goal, decisions, cards, model and settings, open question); the session restarts
  from system prompt + handoff + the last 4 turns. No tokenizer.
- **Attachments** are staged in `<APP_USER_DATA>/agent/attachments/` (`os.tmpdir()/cubric-agent`
  when standalone), wiped at server start and on reset. Crops go to `.../agent/crops/`.

## The shared LLM connection (every Remote job; the Enhancement/Descriptions side is llm.md)

A profile is a CONNECTION: `{ id, name, baseURL }` + a write-only key (`main/secretsStore.js`); presets
DeepInfra (the existing key slot), OpenRouter, OpenAI, Ollama `/v1`, custom. ONE pick,
`Storage.getLlmConnection()`; each job keeps its model (`Storage.getAgentPrefs()` -> `{ model, mode }`).
Settings: the connection block tops Remote > Language Models; the Agent row is "Remote" + model + mode + tool test.

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
- **`RECOMMENDED_REMOTE_MODELS`**: `{ [presetId]: [{ id, jobs: ('agent'|'enhance'|'describe')[], contextWindow? }] }`, exact ids.
- **The agent's context window**: that table, else the endpoint's own entry, else `FALLBACK_CONTEXT_WINDOW` (32,768).
- **`DeepInfraEngine.chat`** forwards `tools` and returns `toolCalls` and `usage` beside `text`.

## `look` coordinates

The describer sees the crop (or the whole image) scaled to ~1 MP (`image_descriptor.json` node 41).
A point maps back as `x_orig = crop.x + x_in * crop.width / inputWidth` (same for y), a tested pure
function; the answer's raw format and space are chosen from Phase 4's recorded answers.
