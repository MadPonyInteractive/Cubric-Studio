# Agent chat — the in-app agent contract (MPI-774, slice A)

An Agent | Prompt toggle turns the prompt box into a chat with a **server-side** loop that recommends
and installs models, generates through the connector, sees images through the describer, and compacts
itself. Spec: `.agents/mpi-kanban/tasks/MPI-774/brief.md`. Contract first (2026-09-15), kept current.

## Shape

- **Loop** `services/agentLoop.mjs`: one loop is one conversation, in server memory; `routes/agent.js`
  mounts `services/agentSessions.mjs`, one per project plus the landing page's (§ Conversations).
- **Tools are connector routes.** `services/agentTools.mjs` is a fetch table over loopback, so a
  CLI agent (MPI-593) gets the same surface. No second dispatch path (`routes/connector.js` header).
- **Chat** `js/components/Compounds/MpiAgentChat/`, twice: the landing slot (standalone, beside the
  headline: the landing page's conversation) and the shell panel `#agent-panel-mount`
  (`js/shell/agentPanel.js`: the open project's), LEFT, from under the topbar to the status bar,
  open while `state.agentMode` is true (the PromptBox toggle). Its right edge drags
  (`MpiResizeHandle`; 280-900 px, at most half the area, stored as `AGENT_PANEL_WIDTH`, default 420),
  and the workspace, prompt box and controls start right of it (MPI-797). The PromptBox sends with
  `agent:send`, image chips as attachments. The toggle is the agent's head, the Studio robot (`MpiButton` `image`,
  `assets/mascot/studio/logo.webp`, as tall as the Enhance button). **In Agent mode the PromptBox is an agent box:** only the
  text and the toggle show; the text is the agent's own (the prompt survives), with a usage hint;
  chips are images, numbered by position, up to 9, whatever the op takes; Ctrl+Enter sends too; back
  in Prompt mode the chips fit the op again. A chat reloads from
  `/agent/history?project=` on mount, `project:changed` and `agent:session`, and renders only events
  whose `session` is its own. A result card emits `gallery:open-card`; the shell opens that card.
- **One stream.** `agentService.agentInitStream()` (shell boot) opens the only `/agent/stream` and
  re-emits every `agent:*` event on `Events`; chats, and the later mascot animations, subscribe there.
- **Keys** stay in `main/secretsStore.js`, read by the server over the fork bridge (`routes/forkBridge.js`
  `ask`); the renderer sets, tests and clears, never reads. **Envelope:** `{ ok: true, ... }` or
  `{ ok: false, error: { code, message } }`; a malformed body is HTTP 400 `BAD_REQUEST`, all else 200.

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
| 14 | Memory while the app is open; per-project notes after it | a conversation per project, `GET /agent/history?project=`; `<project>/Agent/` via `read_memory` / `write_memory` |
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
| `list_projects` / `create_project` | `{}` / `{ name }` | `GET /connector/projects` / `POST /connector/create-project` |
| `open_project` | `{ folderPath: string }` required | `POST /connector/open-project`, only a folder `list_projects` or `create_project` gave, the open project, or one the user typed (`UNKNOWN_PROJECT`) |
| `rename_card` | `{ groupId, name }` required | `POST /connector/rename-card`, only a card this conversation generated (`UNKNOWN_CARD`) |
| `read_memory` / `write_memory` | `{ file? }` / `{ file, title, text, hook? }` | `/connector/memory` for the OPEN project only (`NO_PROJECT`) |

- **Never deletes** (Fabio, 2026-09-16): no tool deletes, and `agentTools.mjs` reaches an allowlist of
  routes (`tests/agent-no-delete.test.cjs` bites on a new tool or route). Outside agents (CLI, the
  skills) keep the delete routes: that is their user's call.
- `image` / `media[].image` is a ref from the `_images` allowlist (this conversation's attachment ids,
  its own results' `filePath`s), **nothing else**: any other string is `IMAGE_NOT_FOUND`, never read
  off disk (the engine may be a remote Pod). An attachment is copied into the project with `POST
  /project-media/:id/place-preview-asset?folderPath=` **only when a generate uses it**; a result goes
  as `/project-file?path=`. `crop` and `box` are in ORIGINAL pixels. `generate` with no project: `NO_PROJECT`.

## Connector routes (W1, `routes/connector.js`)

- **`GET /connector/models`** -> `{ ok, engine: 'local'|'remote', hardware: { gpuName, vramGb, ramGb },
  models: [{ id, name, type, installed, ops: [{ op, installed, params: { ratios, qualityTiers, turbo,
  styles }, media: [{ role, type, required, tag? }] }], missingDownloadGb, fit: { floorVramGb,
  ramGbAtYourVram, runs }, guides: [id] }], flows: [{ id, title, operation, installed, fields: [{ id, label }],
  boxParams: [{ param, role, ratio, overflow }] }] }`. `params` = `generationControls.namedParamsFor`;
  `media` = the op's `mediaInputs` through `filterMediaInputsForModel` (`mediaRolesFor`); `guides` =
  `agentCorpus.guideIdsByModel()`. Install state and ops from the renderer relay; hardware from `GET
  /system/gpu-info`, or `GET /remote/pod/specs` when remote is active. Errors: `APP_UNAVAILABLE`.
- **`GET /connector/knowledge[/:id]`** -> `{ ok, entries: [{ id, kind, title, tags }] }` / `{ ok, id, title,
  text }` from `agentCorpus.listCorpus()`: recipe briefs (`model`), our guide per recipe (`guide`,
  `docs/agent/models/<recipeId>.md`), the Cubric Studio skills (`skill`, `.claude/skills/cubric-vision*`,
  staged by `copyAgentSkills` in `docs/agent/skills/` for the portable build), `docs/agent/*.md` (`app`).
  Errors: `UNKNOWN_ENTRY`.
- **`GET /connector/memory[/:file]?folderPath=`** -> `{ ok, notes: [{ title, file, hook }] }` / `{ ok,
  file, text }`; **`POST /connector/memory { folderPath, file, title, text, hook? }`** -> `{ ok, file,
  created }` (`services/agentMemory.mjs`). `<project>/Agent/README.md` indexes one `<slug>.md` per note.
  No delete route. Errors: `BAD_REQUEST` (400), `NOT_A_PROJECT`, `UNKNOWN_NOTE`, `NOTE_TOO_LONG` (4 KB), `MEMORY_FULL` (100).
- **`GET /connector/projects`** -> `{ ok, projects: [{ name, folderPath, updatedAt }], total }`, most
  recent first, at most 50 (over `POST /list-projects`). **`POST /connector/create-project { name }`**
  -> `{ ok, project: { name, folderPath } }` in the default root, over `POST /create-project`, which never
  replaces one (a taken folder gets `_<8 hex>`); it does not open it. Errors: `BAD_REQUEST` (400), `RUNTIME_ERROR`.
- **`POST /connector/install { modelId }`** -> `{ ok, modelId, downloadGb, started: true }`; progress is
  `GET /comfy/downloads/status`. No gate here: a CLI agent's user is its own gate. Errors: `BAD_REQUEST`,
  `UNKNOWN_MODEL`, `ALREADY_INSTALLED`, `OFFLINE`, `APP_UNAVAILABLE`.
- **`POST /connector/describe { imagePath, question?, crop?, box? }`** -> `{ ok, output: { text, box? } }`.
  `imagePath` absolute; a `crop` is cut with `sharp` to the agent dir first; no `question` = the caption
  instruction; relayed as `agent.describe` to `llmService.describeImage` ([llm.md](llm.md)). **`box`** (needs
  a `question`): both describers answer RELATIVE (Qwen3-VL 0-1000, Remote 0-1, measured), mapped over the
  crop or image to ORIGINAL pixels (`boxFromDescribeAnswer`) + `square` (for `ratio: 1`); unreadable -> `NO_BOX`. Errors: `BAD_REQUEST`,
  `IMAGE_NOT_FOUND`, `CROP_OUT_OF_BOUNDS`, `NO_BOX`, `DESCRIBER_MISSING`, Remote codes, `APP_UNAVAILABLE`, `RUNTIME_ERROR`, `TIMEOUT`.
- **`POST /connector/generate`, Flow `params`** `{ box1: { x, y, width, height } }`: checked against the
  flow's `kind: 'box'` steps (known `param`, integers, square when `ratio: 1`), merged into
  `injectionParams`; no bounds check (every shipped box step declares `overflow: 'allow'`). Errors:
  `UNKNOWN_PARAM`, `INVALID_BOX`. `resources/cubric/connector-manifest.json` lists what is served.

## Agent routes (W2, `routes/agent.js`)

- **`POST /agent/message { text, attachments?: [{ name, dataUrl }], project: { folderPath, name } | null,
  mode: 'auto'|'ask', profileId, model? }`** -> `{ ok, turnId, session, attachments: [{ id, name }] }` at
  once; the reply comes on the stream. `project` picks the conversation (null = the landing page); `model`
  = the agent's pick (`''` = the preset's). Errors: `BAD_REQUEST`, `NO_PROFILE`, `BUSY` (a turn is running
  in ANY conversation); on the stream `NO_KEY`, `NO_MODEL`.
- **`GET /agent/history?project=`** -> `{ ok, session, working, pendingConfirm, usage: { promptTokens,
  contextWindow }, entries: [{ id, at, kind: 'user'|'agent'|'tool'|'result'|'confirm'|'handoff', text?,
  attachments?, tool?, args?, status?, output?, error? }] }`; empty for a project with no conversation.
  **`POST /agent/reset?project=`** -> `{ ok }`, that conversation only. **`GET /agent/attachment/:id`** ->
  the staged file of any conversation's attachment id, else 404. **`GET /agent/stream`**: SSE, below.
- **`POST /agent/confirm { confirmId, yes }`** -> `{ ok }` in the conversation showing the card: Yes
  installs and re-reads the models, No records "declined". Errors: `UNKNOWN_CONFIRM` (stale or answered).
- **`POST /agent/probe { profileId, model? }`** -> `{ ok, tools, model, latencyMs, message }`: one tiny call
  with one tool, **never retried without it**. Errors: `NO_PROFILE`, `NO_KEY`, `NO_MODEL`, `ENDPOINT_ERROR` (+ `status`).

## SSE events (`/agent/stream`)

Every event but `agent:session` also carries `session`, the key of its conversation.

| Event | Data | UI |
|---|---|---|
| `agent:working` | `{ turnId, working: boolean }` | mascot `waiting.png` + float while true |
| `agent:message` | `{ turnId, id, text }` | one whole reply per model turn (D3) |
| `agent:tool` | `{ turnId, id, tool, status, label }`, status `started` / `done` / `failed` | status line; `label` is plain copy, never the prompt |
| `agent:confirm` | `{ turnId, confirmId, kind: 'install', modelId, modelName, downloadGb }` | Yes / No card |
| `agent:result` | `{ toolCallId, ok, output?: { itemId, groupId, type, filePath }, error? }` | result card, opens the card; `filePath` is the renderer item's, already a `/project-file?path=` url |
| `agent:compacting` | `{ turnId, on: boolean }` | "compacting" line + mascot |
| `agent:error` | `{ turnId, code, message }` | error line. Codes: `ENDPOINT_ERROR`, `NO_KEY`, `TOOLS_UNSUPPORTED`, `STEP_LIMIT` |
| `agent:user` | `{ turnId, id, text, attachments }` | a request carried in from another conversation (D5): its bubble, once by `id` (the sender's own chat draws its bubble itself) |
| `agent:session` | `{ from, to }` | a conversation moved into a project: chats showing either side reload |

## Conversations (Phase 3c, Fabio's D4-D6, 2026-09-16)

- **Key:** the project folder (`projectKey`: forward slashes, case-blind on Windows and macOS); `''` =
  the landing page. The renderer never builds one: it echoes the `session` the server sent.
- **D4:** one turn at a time, app-wide; a turn started in project A finishes in A's conversation.
- **D5:** when `open_project` succeeds on another project, the LANDING conversation moves into it if it
  has none (`agent:session`; the landing page starts fresh). Otherwise the turn ends ("I'll carry on in
  its own chat") and the request, attachments included, runs next in that project's conversation as
  "From <the landing page | project>: ...", with an opening line telling the model the project is
  already open for it (else it re-ran "open X"), and an `agent:user` so the bubble shows live. Tests: `tests/agent-sessions.test.cjs`, `agent-chat.spec.js`.
- **D6:** memory only; the `<project>/Agent/` notes survive a restart. Nothing is evicted.
- **Landing jobs** (Project rule): "make X" with no project -> `create_project("New Project")`, open, generate;
  "a new project, the goal is X" -> named after the goal, created, opened, a project-brief `write_memory`, then it asks what to make
  first and generates nothing that turn.

## Loop rules (W2)

- **System prompt:** role; mode (Auto: turbo on images, `medium` + turbo on video where `params` offer
  them; Ask first: ask about every setting); model, settings, looking, guide, install, project,
  deletion, memory and naming rules; the honest limits; the knowledge index.
- **Opening lines** of every user message: the app state (the open project by NAME; "Images you can look
  at:" = the `_images` allowlist), the project's notes index once per project (first turn, a switch, a
  compaction), then what finished since the last turn. A successful `open_project` updates the project
  for the rest of the turn, and its result carries the new project's notes.
- **Gates** (a rule alone did not do it; a compaction clears both): a model op's `generate` answers `GUIDE_NOT_READ` until this context
  read one of its `guides` (a guide names the mode of any default: a bare one skipped Ask first); a Flow `params` box answers
  `BOX_NOT_MEASURED` until a `look` with `box` measured the image of its role (live, the model guessed 512 px boxes).
- **Harness:** `npm run agent:test` (18 cases x 3, real model, fake tools; `--bite` proves each assertion,
  `--samples <md>` writes prompts to read). A case's `look` is one fixture, or a map keyed by the
  attachment's `filePath` when two images must answer differently — two portraits giving the identical
  answer read to the model as a broken describer and it stopped rather than measuring. **Bounded
  steps:** 8 tool calls per user turn, then `STEP_LIMIT` — which a case can hit for reasons of its
  own: the box case first described TWO women, and its flip spent the whole budget telling them apart
  and "failed" on the step limit rather than on what it asserts. A case's scene is part of the
  assertion.
- **Generate** is fired, not awaited. On settle: `agent:result`, a queued "[Generation finished: card
  <groupId> ...]" (or failed) line for the next turn, and a queued `look` on an image (a message pushed
  mid-turn could split a tool call from its result). No regeneration on its own.
- **Compaction:** at the provider's `prompt_tokens >= contextWindow * (window >= 1M ? 0.30 : 0.50)` (no tokenizer)
  the model writes a handoff (goal, decisions, cards, model, settings, open question); restart = system prompt + handoff + the
  newest turns (at most 4) that fit in HALF the trigger, sized by the last call's tokens per char. Four whole turns
  could sit above the trigger alone (a `list_models` answer is ~9.5k tokens; a 32k window triggers at 16.4k), and
  then every turn compacted again (live, Phase 4).
- **Attachments:** `<APP_USER_DATA>/agent/attachments/` (`os.tmpdir()/cubric-agent` standalone), wiped
  at server start; a reset discards only its conversation's files. Crops: `.../agent/crops/`.

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
- **`POST /llm/connection/probe { profileId }`** -> `{ ok, latencyMs, modelCount }`; **`GET
  /llm/connection/models?profileId=`** -> `{ ok, profileId, models: [{ id, contextWindow, vision,
  recommendedFor[] }] }`, recommended first, a tagged catalogue (DeepInfra) cut to `chat` models. Errors
  `BAD_REQUEST` (400), `NO_PROFILE`, `NO_KEY` (not `ollama`), `ENDPOINT_ERROR` + `status`.
- **`RECOMMENDED_REMOTE_MODELS`**: `{ [presetId]: [{ id, jobs: ('agent'|'enhance'|'describe')[], contextWindow? }] }`, exact ids.
  The agent's context window: that table, else the endpoint's own entry, else `FALLBACK_CONTEXT_WINDOW` (32,768).
- **`DeepInfraEngine.chat`** forwards `tools` and returns `toolCalls` and `usage` beside `text`.
  `OllamaEngine.chat` does NOT — it is the enhance client, so the agent runs on Ollama through that
  preset's OpenAI-compatible `/v1` and `DeepInfraEngine`, not through the native route.
- **`ollama` is keyless everywhere, the agent included**: `runTurn` and `probe`
  (`services/agentLoop.mjs`) skip `NO_KEY` for it exactly as the `routes/llm.js` checks do. Two
  Ollama caveats the app does not surface: only a model whose `/api/show` capabilities include
  `tools` can be the agent, and `/v1` carries no `num_ctx`, so the server's own
  `OLLAMA_CONTEXT_LENGTH` (4096 by default) has to hold the system prompt plus 11 tool schemas
  (~3.7k tokens) before the user's first word.

## `look` coordinates

The describer sees the crop (or the whole image) scaled to ~1 MP (`image_descriptor.json` node 41).
A point maps back as `x_orig = crop.x + x_in * crop.width / inputWidth` (same for y), a tested pure
function; the answer's raw format and space are chosen from Phase 4's recorded answers.

A `box: true` answer also carries `imageSize`, `boxShare` and `squareShare` — what the box and its
square take of the image (`boxShare` in `routes/connector.js`). The Box rule refuses a `squareShare`
over 0.6 on either side and measures again: asked for a head on a group photo the describer boxes the
whole person, and `square` then matches that height in width, which swallows the neighbour (live,
Phase 5: `1166x1166` at `x -245` on 1664x2304, and `1171x1171` on a 768x1344 photo). 0.6 is measured,
not chosen: three real head boxes square to at most 0.52, the two bad ones start at 0.70
(`tests/connector-agent-tools.test.cjs`).

## Model ranking (Phase 5, `modelConstants/modelPriority.js`)

Every op in `GET /connector/models` carries a `rank` for its task (1 = the best we have) and,
where it changes the pick, a one-line `note` — the half a ranking cannot hold ("takes exactly one
image", "leaves everything outside the edit area untouched"). One image order filtered by
`supportedOps` covers all six image tasks; edit and the video tasks are explicit `{modelId, op}`
lists, because those op ids are per model. `-nsfw` variants and single-candidate tasks are unranked
on purpose.

**The Model rule names the TASK first, deliberately.** A rank attached to an op reads to the model as
a rank attached to the WORK, and it will cross a task boundary to reach a 1: asked to redo an edit
with Krea 2 it ran `krea2 i2i` and cited "its best realism op, rank 1" (live, harness
`ranked-editor`). Ranks compare ops within one task only.

## Agent surfaces (Phase 5)

- **Stop stays reachable in Agent mode.** The agent has no cancel tool and will not get one, so the
  user's own Stop is the only way to halt a generation it started. Agent mode keeps
  `.mpi-prompt-box__col--run` and hides everything in it but `.mpi-prompt-box__stop-host`; the cancel
  path behind it is origin-blind and already arms itself from `activeGenerations`.
- **A video result is a `<video>`.** `MpiAgentChat._appendResult` built an `<img>` for every result,
  so a video result painted as a broken tile captioned "video". Either element's `error` swaps in a
  fallback tile, which is also what a stopped generation's missing file now shows.
- **The agent is Studio cream.** `.mpi-agent-chat` and the prompt box's `__col--mode` rebind
  `--accent-heat` to `--hub-accent` for their subtree, so the Primitives mounted inside them carry it
  through their hover and active states too.
- **Language Models loads visibly.** Every control in that section mounts from an async read, so a
  cold open used to paint labels with nothing under them; the section now shows a spinner and keeps
  its subgroups out of the flow until the read lands.
