# Agent chat — the in-app agent contract (MPI-774, slice A)

The in-app agent: an Agent | Prompt toggle turns `MpiPromptBox` into a chat with a
**server-side** loop that recommends and installs models, generates through the connector,
sees images through the describer, and compacts itself. Spec: `.agents/mpi-kanban/tasks/MPI-774/brief.md`.

**Written as the contract BEFORE the code (Phase 0, 2026-09-15).** Batch 1 workers build against
it; rewrite it to current truth when the card closes.

## Shape

- **Loop** `services/agentLoop.mjs`, mounted by `routes/agent.js`. One session, in server memory.
- **Tools are connector routes.** `services/agentTools.mjs` is a fetch table over loopback, so a
  CLI agent (MPI-593) gets the same surface. No second dispatch path (`routes/connector.js` header).
- **Chat** `js/components/Compounds/MpiAgentChat/`, inside `MpiPromptBox` in Agent mode, plus one
  landing slot. `js/services/agentService.js` POSTs messages, listens on `/agent/stream`, and
  re-renders from `/agent/history` on mount (Landing -> Gallery -> History keeps the chat).
- **Keys** stay in `main/secretsStore.js`; the server reads them over the fork bridge
  (`routes/forkBridge.js` `ask`). The renderer can set, test and clear, never read.

Every route answers `{ ok: true, ... }` or `{ ok: false, error: { code, message } }`, the
connector's envelope. A malformed body is HTTP 400 `BAD_REQUEST`; everything else is 200.

## Brief items -> surface

| # | Brief item | Route / event / UI |
|---|---|---|
| 1 | Toggle, Enter sends, drop images, landing entry | `MpiPromptBox` toggle; `MpiAgentChat`; landing slot; `POST /agent/message` with `project: null` |
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

JSON Schema `parameters`, OpenAI `tools` format. A tool the model invents is refused with
`UNKNOWN_TOOL` in the tool result, never guessed at.

| Tool | Parameters | Executes |
|---|---|---|
| `list_models` | `{}` | `GET /connector/models` |
| `read_knowledge` | `{ id?: string }` (no id = the index) | `GET /connector/knowledge[/:id]` |
| `install_model` | `{ modelId: string }` required | **never directly**: emits `agent:confirm`; `POST /agent/confirm` runs it |
| `generate` | `{ modelId?, operation?, flowId?, prompt?, negative?, ratio?, qualityTier?, turbo?, styleSelect?, stylization?, seed?, fields?: object, params?: object, media?: [{ role, image }] }` | `POST /connector/generate`, fired and not awaited |
| `look` | `{ image: string, question?: string, crop?: {x,y,width,height}, box?: boolean }`, `image` required | `POST /connector/describe` |
| `open_project` | `{ folderPath: string }` required | `POST /connector/open-project` |

- `image` / `media[].image` is a chat attachment id (`att_1`) or a result `filePath`, **and
  nothing else**: the loop keeps the session's attachment ids and its own generations' output
  paths, and any other string the model emits is refused with `IMAGE_NOT_FOUND` rather than read
  off the user's disk (the engine may be a remote Pod). The loop resolves it: an attachment is
  copied into the project with `POST /project-media/:id/place-preview-asset?folderPath=` **only
  when a generate uses it** (the route's `dataUrl` takes a plain absolute path), and its returned
  url becomes `media[].url`; a result is passed as `/project-file?path=<filePath>`. `crop` and
  `box` are in ORIGINAL pixels.
- `generate` refuses by name before any spend when `project` is null: `NO_PROJECT`, and the
  agent asks for a project.

## Connector routes (W1, `routes/connector.js`)

**`GET /connector/models`** -> `{ ok, engine: 'local'|'remote', hardware: { gpuName, vramGb, ramGb },
models: [{ id, name, type, installed, ops: [{ op, installed }], missingDownloadGb,
fit: { floorVramGb, ramGbAtYourVram, runs } }], flows: [{ id, title, operation, installed,
fields: [id], boxParams: [{ param, role, ratio, overflow }] }] }`. Install state and ops come from
the renderer over a new relay capability (the payload builder is renderer-only, `modelRegistry.js`);
hardware from `GET /system/gpu-info` locally, `GET /remote/pod/specs` when remote is active.
Errors: `APP_UNAVAILABLE`.

**`GET /connector/knowledge`** -> `{ ok, entries: [{ id, kind, title, tags }] }`;
**`GET /connector/knowledge/:id`** -> `{ ok, id, title, text }`. Source: `services/agentCorpus.mjs`
`listCorpus()`. Errors: `UNKNOWN_ENTRY`.

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
mode: 'auto'|'ask', profileId }`** -> `{ ok, turnId, attachments: [{ id, name }] }`, at once. The reply
arrives on the stream. `project` is the renderer's open project at send time. Errors: `BAD_REQUEST`,
`NO_PROFILE`, `NO_KEY`, `BUSY` (a turn is running).

**`GET /agent/stream`** — SSE, `event: <name>` + `data: <json>`. Vocabulary below.

**`GET /agent/history`** -> `{ ok, working, pendingConfirm: {...} | null, usage: { promptTokens,
contextWindow }, entries: [{ id, at, kind: 'user'|'agent'|'tool'|'result'|'confirm'|'handoff',
text?, attachments?, tool?, args?, status?, output?, error? }] }`. Tool entries keep `args` for
tests; the UI shows them as status lines only.

**`POST /agent/confirm { confirmId, yes }`** -> `{ ok }`. Yes runs the install, then re-reads
`GET /connector/models` and reports what landed; No records "declined" as the tool result.
Errors: `UNKNOWN_CONFIRM` (stale or already answered).

**`POST /agent/reset`** -> `{ ok }`. Drops the session and the attachment dir.

**`POST /agent/probe { profileId }`** -> `{ ok, tools: boolean, model, latencyMs, message }`. One
tiny call carrying one tool. A model that cannot call tools is reported, **never retried without
the tool**. Errors: `NO_PROFILE`, `NO_KEY`, `ENDPOINT_ERROR` (with `status`).

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

- **System prompt:** role; mode rules (Auto: image `turbo: true` where offered, video
  `qualityTier: 'medium'` + turbo where offered, ask only when the goal is unclear; Ask first: ask
  about every setting); installs always ask; the honest limits (no video watching, no audio, no
  mask painting, no History tools, no RunPod, no memory across restarts, sees only what `look`
  reported); the knowledge index.
- **Project rule:** `open_project` only takes a path the USER gave. With no project open the agent
  says so and asks; it never guesses a folder (it guessed two on the first live run).
- **Bounded steps:** at most 8 tool calls per user turn, then `agent:error STEP_LIMIT`.
- **Generate** is fired, not awaited. On settle: `agent:result`, the tool result is appended, and
  an image result gets a `look`. No regeneration on its own judgement.
- **Compaction:** after each response, when `usage.prompt_tokens >= contextWindow * (contextWindow
  >= 1_000_000 ? 0.30 : 0.50)`, the model writes a handoff (goal, decisions, cards generated, current
  model and settings, open question); the session restarts from system prompt + handoff + the last
  4 turns. No tokenizer.
- **Attachments** are staged in `<APP_USER_DATA>/agent/attachments/` (`os.tmpdir()/cubric-agent`
  when standalone), wiped at server start and on reset. Crops go to `.../agent/crops/`.

## Endpoint profiles and keys (W3)

Profile: `{ id, name, baseURL, model, contextWindow }`. Presets: DeepInfra (recommended,
`deepseek-ai/DeepSeek-V4-Flash-0731`, 1,048,576; **reuses the existing DeepInfra slot**), OpenRouter,
OpenAI, Ollama `/v1` (untested, VRAM caveat), custom.

- **A key is bound to the `baseURL` it was saved with.** Editing the profile's URL makes the key
  unusable until it is entered again, so the renderer can never point a stored key at a new host.
- **IPC (renderer):** `secrets:list-endpoint-profiles` (no keys), `secrets:save-endpoint-profile`,
  `secrets:delete-endpoint-profile`, `secrets:set-endpoint-key { profileId, key }`,
  `secrets:has-endpoint-key { profileId }`, `secrets:clear-endpoint-key { profileId }`. **No get.**
- **Fork bridge (server):** `secrets:get-endpoint-profile-request { profileId }` ->
  `secrets:get-endpoint-profile-response { id, profile | null, key | null }`; `key` is null when its
  bound URL differs from `profile.baseURL`.
- **Key order for the `deepinfra` preset: the stored key, then `DEEPINFRA_API_KEY`** — the same
  order `routes/llm.js` uses, in Electron as well as standalone (a dev run and the harness run
  inside Electron too). The environment key is only ever used while the profile's `baseURL` is
  still DeepInfra's.
- **`DeepInfraEngine.chat`** forwards `tools` and returns `toolCalls` and `usage` beside `text`;
  existing enhance callers are unchanged.

## `look` coordinates

The describer sees the crop (if any) scaled to ~1 MP (`image_descriptor.json` node 41,
`ImageScaleToTotalPixels`, 1 MP, steps of 16). A point in that input space maps back as
`x_orig = crop.x + x_in * crop.width / inputWidth` (same for y; no crop = the whole image). W1
ships this as a pure function with a round-trip test; the answer's raw format and space
(pixels of the scaled input, or 0-1000 normalised) are chosen from Phase 4's recorded answers.
