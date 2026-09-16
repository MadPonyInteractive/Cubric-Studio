# MPI-774 - In-app agent, slice A

## Current State

**Project mode:** scalable-foundation. **Spec:** `brief.md` (every product decision is Fabio's,
2026-09-15). **Parent:** MPI-677 (umbrella, `doing`, only Fabio's user-ux passes left).
**Evidence behind this plan:** `research/investigation.md` - verified facts with file:line, the
seven investigator claims that turned out wrong, and a live orchestrator probe.

**Where it stands (2026-09-16, session 7ab56409):** Phase 0 and Parallel Batch 1 are done, verified
and **pushed** (`4cfc489e`; master CI green on `2d4c28d6`, which carries it). The three carried
integration items and the landing rearrange are **done and verified** (evidence in `validation.md`
§ Phase 3), and so is **the wiring run** — which found and fixed two real defects (an Electron-only
`NO_KEY`, and the agent inventing project folder paths) and re-probed the `/connector/*` routes.
**Next: the scripted harness** (`scripts/agent-test.mjs`, the nine brief cases 3× against fake
tools), then the prompt-quality sample. Nothing is committed yet this session. GPU stays off-limits
until Phase 4.

**The three integration items, as built (2026-09-16):**
1. **Trust boundary.** The loop keeps `_images`: attachment ids staged this session, and the output
   paths of its own generations. `look`/`generate` resolve only through it; anything else the model
   emits is `IMAGE_NOT_FOUND`. `agentTools.resolveImageRef` is gone.
2. **Attachments are placed**, only when a generate uses one, through `placeAsset` ->
   `POST /project-media/agent/place-preview-asset?folderPath=` (its `dataUrl` takes a plain absolute
   path), and the returned url becomes `media[].url`. A result goes back as `/project-file?path=`.
3. **The bounds branch is dropped**, not rebuilt: it read `pixelDimensions` that `resolveAgentMedia`
   never sets, and all three shipped box steps declare `overflow: 'allow'`. The ceiling and the
   upgrade path are a `ponytail:` comment on `validateBoxParams` and an assertion in its test.

**Batch 1 running notes (orchestrator re-verified each report on disk, never took one on trust):**
- **W3 done.** 8/8 + llm-service 18/18. Its in-test "mutation" was a simulation, so the binding check
  was broken in the REAL handler: red, then byte-identical restore green. **Defect fixed:** its writes
  turned `main/secretsStore.js` + `js/core/secretsClient.js` CRLF (HEAD is LF; `git diff --stat`
  hides it) - reverted to LF. Claim `complete`.
- **W2 done.** agent-loop 13/13 (+1 live test skipped without key; worker's live run: `list_models`
  called, 1,351 prompt tokens, 7.1 s). llmEngines consumers 13/13. Gate removed in the REAL loop ->
  2 red; restored -> green. Line endings clean. Claim `needs_integration` for two items W2 reported
  as "no deviation" but are:
  1. **Trust boundary:** `agentTools.resolveImageRef` treats any non-`att_` string the MODEL emits
     as an absolute path, so `look`/`generate` can be pointed at any file on disk (a key file) and
     ship it to the engine, which may be a remote Pod. Restrict to this session's attachments and
     result `filePath`s.
  2. **Contract:** attachments go to `generate` as a raw staged path in `media[].url`, not copied
     into the project via `place-preview-asset` (contract § Tools). Fix against W1's media shape.
  Also for the UX pass: an unanswered install card keeps the turn `working` (BUSY) until Yes/No or
  `/agent/reset`.
- **W1 done.** connector tools 14/14, eslint clean (one unused `eslint-disable` removed). CRLF churn
  on `routes/connector.js` + `scripts/build-portable.mjs` reverted to LF. Real mutations in
  `validateBoxParams`: UNKNOWN_PARAM, integers, square -> red; **bounds stayed GREEN** - its test
  only asserted the in-bounds case (name lied). Test now asserts the rejection + the `overflow:
  'allow'` pass; mutation re-run pending. **Phase 3 item:** `resolveAgentMedia` items carry no
  `pixelDimensions`, so the bounds check never runs on a real submit (no shipped flow needs it yet:
  both Head Swap steps allow overflow) - read dims where the path is known, or drop the branch.
  **Manifest:** W1 was right, and the release doc was wrong: MPI-677 step 2 (`3b8052d6`) removed the
  broker responder, so `system.memory.release` is unserved; `docs/releases/portable-distribution-contract.md`
  § Connector Manifest still described the responder - orchestrator fixes it.
- **W4 done.** lint:components clean. CRLF churn on `MpiPromptBox.js/.css` reverted. Raw
  `es.addEventListener` in `agentService.js` -> `on()` (dom.js takes any EventTarget). **Ownership
  breach:** W4 wrote the landing slot `<div>` into `index.html` (not owned; no live claim held it) -
  accepted as integrator, claimed. W4 did NOT run its desktop spec (it wrongly thought the runner
  would touch `:3000`); the orchestrator runs it with a private `--output`.

**Card tags:** RunPod **no** (slice A never touches a Pod). Linux box **no**. GPU **yes**, Phase 4
only (live generations and looks; `/connector/generate` is a `guard-gpu` pattern, so take the
lease).

### Decisions (settled - Fabio accepted all three as recommended, 2026-09-15)

Fabio, 2026-09-15: *"We are on the same page. I accept all your recommendations for D1, D2, and
D3."*

- **D1. `look` ships on the ComfyUI describer inside this card; it does not wait for MPI-737.**
  MPI-737 later adds the cloud backend behind the same route. Cost of the default: the agent has
  no eyes until the Image Describer plugin is installed, and it says so. It also needs one edit
  from Fabio in `comfy_workflows/raw/image_descriptor.json` (Phase 0), because the caption
  instruction (node 38) cannot be injected today.
- **D2. The install gate is a Yes / No card in the chat**, not a typed "yes" the model
  interprets. The loop never executes an install without the button. This makes "installs always
  ask" structural and testable, and avoids Calliope's regex-permission trap.
- **D3. Replies arrive whole per model turn, not typed out token by token.** Events stream
  (working, tool started, result, compacting); text does not. Measured turn time is 1.5-3.1 s.
  Token streaming gets added only if the UX pass says it feels slow.

### Settled here (resolve-then-act, not Fabio's forks)

- **Every agent tool is an HTTP route on the connector.** The loop's tool executor is a fetch
  table over loopback. The brief says the tools ARE the connector contract; this makes it literal,
  gives CLI agents (MPI-593) the same surface for free, and creates no second dispatch path
  (`connector.js:34-46` warns against mixing).
- **Non-blocking generate:** the loop does not await the generate call inside the turn. When it
  settles, the loop posts the result into the chat and runs `look` on an image result. No
  job-status route. Known ceiling: `JOB_TIMEOUT_MS` is 30 min, so a longer job reports `TIMEOUT`
  while it keeps running, and the agent says exactly that. Upgrade path: a job-status route.
- **Compaction trigger** = the provider's own `usage.prompt_tokens` from the last response
  against the profile's context window: 50%, or 30% when the window is 1M or more. No tokenizer.
- **Endpoint keys are bound to the base URL they were saved with.** The server takes base URL and
  key together from the secrets store by profile id; the renderer never supplies a URL that
  receives a key.
- **The chat session lives in server memory** (brief item 14). The renderer re-renders from
  `GET /agent/history` on mount, so Landing -> Gallery -> History keeps the conversation. Nothing
  on disk.
- **Auto defaults per model, never invented:** image -> `turbo: true` where the model offers it;
  video -> `qualityTier: 'medium'` plus turbo where offered. A param the model lacks is omitted
  (the connector already validates per model).
- **`connector-manifest.json` becomes truthful:** it lists what the connector serves, and
  `assertConnectorManifest` asserts `generation.submit` instead of the unserved
  `system.memory.release`. Only three files consume it (grepped).
- **Hardware fit** reads the active engine's capacity: `GET /system/gpu-info` locally, the Pod
  capacity handler (`remotePodLifecycle.js`) when remote is active, fed to `footprint.js`
  `tradeTable()` for the "not at your VRAM, yes with 44 GB of RAM" line.
- **Orchestrator stays `deepseek-ai/DeepSeek-V4-Flash-0731`.** The probe passed the smell test for
  criteria 1-2 (right tool, `reasoning_tokens: 0`, Auto settings with zero questions). The 3/3
  harness (Phase 3) is the real gate.

### What exists vs what is missing (detail in `research/investigation.md`)

| Tool | Exists | Missing |
|---|---|---|
| open project | `POST /connector/open-project` | nothing |
| generate, model op | `POST /connector/generate`, named params, media by reference | only the non-blocking use above |
| generate, Flow | same route with `flowId`, fields, media | box params: a step `param` is never read from input |
| look | `imageDescribe` universal text op; `agentDispatch` already reports `onText` | a no-model branch (`_submitGeneration` refuses without `modelId`), an injectable question, crop, box parse |
| list models | renderer install state, `footprint.js`, `/system/gpu-info` | a route; the install-state payload builder is renderer-only |
| read knowledge | `listCorpus()` | a route |
| install model | download start / status / models check | size before install, the ask gate |
| the loop | `DeepInfraEngine` (text only), fork-bridge key | tools + usage passthrough, sessions, compaction, SSE, profiles |
| the chat | `MpiPromptBox`, `MpiLlmSettings` Agent-row slot, mascot images, markdown util | toggle, transcript, confirm card, landing entry, agent row |

### Collisions (checked 2026-09-15; re-check before Batch 1)

- **MPI-677 (`doing`)** lists in `files.json`: `services/llmEngines.mjs`, `routes/llm.js`,
  `js/services/llmService.js`, `js/core/secretsClient.js`, `main/secretsStore.js`, `server.js`,
  `js/components/Organisms/MpiPromptBox/**`. No live claims; only user-ux passes remain. If it is
  still in `doing` at Batch 1, send one `mpi-message` naming these paths, then edit by content
  anchor (a UX-pass fix may land in the same file).
- **MPI-591 / MPI-623 (`doing`)** own `commandExecutor.js`, `generationService.js`,
  `flowsRegistry.js`, `universal_workflows.js`. **This plan edits none of them.** A worker that
  finds it must: stop and `mpi-message`.
- **MPI-766 (`todo`, blocked)** rebuilds the landing page. Slice A mounts its landing entry as one
  component in one slot, so MPI-766 moves a mount rather than a feature.
- **MPI-737 (`todo`)** owns the cloud describer and the Descriptions dropdown. This card builds
  the `look` route and its three growths (question, crop, box) against ComfyUI.

## Completed

- [x] Investigation and plan (2026-09-15): four read-only investigations, planning-session spot
  checks, a live DeepInfra probe. `research/investigation.md`.
- [x] D1-D3 settled by Fabio (2026-09-15), all as recommended.

## Remaining Work

## Phase 0: Decisions, contract, the describer question

*Verify mode: auto, except the D1-D3 answers.*

- [x] **Get D1-D3 from Fabio.** Record his words under § Decisions; revise the plan where he
  overrides. **Verify:** § Decisions carries his answer for each, dated. *Done 2026-09-15: all
  three accepted as recommended, no revision.*
- [x] **Write the contract, `docs/agent-chat.md`** (new subsystem doc, routed from
  `docs/README.md`, 200 lines max). It holds: the JSON schema of every tool; each new route's
  request/response and error codes (`/connector/models`, `/connector/knowledge[/:id]`,
  `/connector/install`, `/connector/describe`, Flow `params`, and `/agent/message`,
  `/agent/stream`, `/agent/history`, `/agent/confirm`, `/agent/reset`, `/agent/probe`); the SSE
  event vocabulary (`agent:working`, `agent:message`, `agent:tool`, `agent:confirm`,
  `agent:result`, `agent:compacting`, `agent:error`); the fork-bridge message for profile keys;
  `look`'s answer `{text, box?}` with the box in ORIGINAL image pixels; where images attached in
  chat are staged (an agent scratch dir; copied into the project only when a generate uses them).
  **Verify:** a table in the doc maps brief items 1-15 to a route, an event or a UI element with
  no gaps; every tool in brief § Architecture has a schema; `docs/README.md` routes to it.
- [x] **The describer question (D1).** Deliver the raw node list (file, node id, widget index) so
  a question can be injected while the right-click caption keeps its current instruction. Fabio
  edits `comfy_workflows/raw/image_descriptor.json`; the agent runs
  `node scripts/sync-raw-workflows.mjs`. Do not hand-edit workflow JSON. **Verify:** the synced
  runtime file has an `Input_*`-titled node feeding the prompt; `node --test
  tests/inject-params-titles.test.cjs` green; with no question injected the graph text is
  unchanged from today's instruction (diff the two).

## Parallel Batch 1: four foundations

Run with `mpi-execute-parallel`, only after Phase 0. Each worker builds against
`docs/agent-chat.md`, tests with fakes or stubs, and edits nothing outside its Ownership. Every
worker brief carries the CLAUDE.md Critical Rules Snapshot and `.claude/rules/root-cause.md`
§ Sub-Agent Briefing. *Verify mode: auto.*

**Why it is batch-safe:** ownership is disjoint; W1<->W2 meet only at the HTTP contract (W2 tests
with fake tools), W2<->W3 at the fork-bridge message and `/agent/probe` (W3 stubs fetch), W2<->W4
at the SSE contract (W4 stubs `fetch`/`EventSource`). `server.js` is touched by W2 alone, one
mount line.

- [x] **W1 - connector growth.** Ownership: `routes/connector.js`, `js/shell/agentDispatch.js`,
  `resources/cubric/connector-manifest.json`, `scripts/build-portable.mjs`
  (`assertConnectorManifest` only), `tests/connector-agent-tools.test.cjs` (new),
  `.claude/skills/cubric-vision/generating.md`. Briefings: `comfy_injection`, `comfy_engine`,
  `events`. Work:
  - `GET /connector/models`: a new relay capability returns install state per effective engine
    and each model's ops from the renderer; the route adds hardware fit (`tradeTable`) and the
    download size of missing deps.
  - `GET /connector/knowledge` (index) and `GET /connector/knowledge/:id` (the entry's `text()`).
  - `POST /connector/install {modelId}`: starts the download of missing deps, returns size and
    started state. No gate here: the gate belongs to the in-app loop; a CLI agent's user is its own.
  - `POST /connector/describe {image, question?, crop?}`: crop with `sharp` to a staged file when
    asked, then relay `imageDescribe` with the question in `injectionParams`; returns `{text}`.
    `agentDispatch` gets the no-model branch for universal text ops and a named
    `DESCRIBER_MISSING` error when the plugin is absent.
  - A pure mapping function: a point or box in the describer's input space (after crop and the
    graph's 1 MP scale) -> original pixels. **The box PARSER waits for Phase 4's measurement;**
    no format is guessed here.
  - Flow submit `params`, e.g. `{box1: {x, y, width, height}}`: validated against the flow's
    `kind: 'box'` steps (known param name, integers, inside the image, square when the step
    locks ratio 1), merged into `injectionParams`. `flowsRegistry.js` is read, not edited.
  - The manifest lists what is served; the assert checks `generation.submit`.
  - `generating.md` documents the new routes (keep each skill file within its 200-line budget).
  **Verify:** `node --test tests/connector-agent-tools.test.cjs` green, and one mutation per
  validator turns it red; the mapping function round-trips a crop + 1 MP scale case; `npm run
  lint`; an isolated `npm run server` on its own port answers every new route with its own
  `BAD_REQUEST` on an empty body (never `:3000`).

- [x] **W2 - the loop.** Ownership: `services/llmEngines.mjs` (`DeepInfraEngine.chat` only),
  `services/agentLoop.mjs` (new), `services/agentTools.mjs` (new), `routes/agent.js` (new),
  `server.js` (one mount line), `tests/agent-loop.test.cjs` (new). Briefings: `root-cause`
  (Snapshot only otherwise). Work:
  - `DeepInfraEngine.chat` forwards `tools` and returns `toolCalls` and `usage` beside `text`;
    every existing enhance caller is unchanged.
  - Session in memory; system prompt = role, mode rules (Auto / Ask first), the honest-limits list
    (brief item 13, in character), the knowledge index. A bounded step count per user turn.
  - Install tool calls never execute: they emit `agent:confirm` with the size, and
    `POST /agent/confirm {id, yes}` executes, then verifies with a real re-read of
    `/connector/models`.
  - Generate is fired without awaiting; on settle it emits `agent:result`, appends the tool result,
    and runs `look` on an image. It never regenerates on its own judgement.
  - Compaction at the trigger: the model writes a handoff (goal, decisions, cards generated,
    current model and settings, open question); the session restarts from system prompt +
    handoff + the last few turns; `agent:compacting` is emitted.
  - `POST /agent/probe {profileId}`: one tiny call carrying a tool; a model that cannot use tools
    is reported plainly. Never strip a capability and retry.
  - `agentTools.mjs` is a fetch table over loopback to W1's routes, per the contract.
  **Verify:** `node --test tests/agent-loop.test.cjs` with a fake engine and fake tools proves:
  install never runs without a confirm (remove the gate -> red); compaction fires at 50% and at
  30% for 1M windows from `usage`; a generate returns control before it settles; probe reports a
  no-tools model without retrying. Plus one live DeepInfra run of the loop against fake tools
  (key in the process env, same shell call).

- [x] **W3 - the Agent row and endpoint keys.** Ownership: `main/secretsStore.js`,
  `js/core/secretsClient.js`, `js/components/Organisms/MpiLlmSettings/**`,
  `tests/secrets-endpoint-profiles.test.cjs` (new). Briefings: `components`, `dos_and_donts`.
  Work:
  - Profiles `{id, name, baseURL, model, contextWindow}`. Presets: **DeepInfra (recommended, with
    its signup link, `deepseek-ai/DeepSeek-V4-Flash-0731`, 1,048,576)**, OpenRouter, OpenAI,
    Ollama `/v1` (labelled untested, with the VRAM caveat), and custom.
  - Keys stored per profile id, bound to base URL; IPC set/has/clear only; read by the server
    through the fork bridge. The DeepInfra preset reuses the existing DeepInfra slot, so a user
    never enters the same key twice.
  - The Agent row: profile, model, mode (Auto / Ask first), and Probe (calls `/agent/probe`,
    shows the answer). Copy follows the no-internal-identifiers rule.
  **Verify:** the test records the IPC channels and proves no renderer-readable get channel
  exists for endpoint keys; a key saved for URL A is refused for the same profile edited to
  URL B (flip the check -> red); `npm run lint:components`.

- [x] **W4 - the chat.** Ownership: `js/components/Organisms/MpiPromptBox/**`,
  `js/components/Compounds/MpiAgentChat/**` (new), `js/services/agentService.js` (new),
  `js/shell/preloadStyles.js` (its css line), `js/components/types.js` (its props),
  `js/shell/projectUI.js` and `styles/shell/landing.css` (the landing slot only),
  `tests/desktop/agent-chat.spec.js` (new). Briefings: `components`, `dos_and_donts`,
  `component-mounts`, `component-events`, `state`. Work:
  - Agent | Prompt toggle on the prompt box. Agent mode: Enter sends, Shift+Enter breaks the line
    (the @-reference picker keeps Enter while it is open), same expand behaviour, drag-and-drop
    images attach to the message.
  - Transcript (markdown via `js/utils/markdown.js`), result cards (thumbnail, opens the card),
    the install confirm card (Yes / No with the size), a "compacting" line. The prompt a generate
    used is not shown (brief item 12).
  - The mascot is always in the box: `assets/mascot/idle.png` when quiet, `waiting.png` with the
    float animation on any `agent:working`.
  - `agentService.js`: POST message, `EventSource` on `/agent/stream`, history on mount.
  - Landing entry with no project open, in one slot.
  **Verify:** the desktop spec with in-page `fetch`/`EventSource` stubs and a private `--output`
  dir: toggle -> chat; Enter sends exactly one POST; Shift+Enter adds a newline; stubbed events
  render; Yes posts `/agent/confirm`; the mascot `src` flips on working and back. `npm run
  lint:components`.

## Phase 3: Integration and the scripted harness

*Sequential: one app instance, and every task needs all four workers. Verify mode: auto, except
the landing rearrange (`user-ux`).*

- [x] **The three carried integration items** (trust boundary, place the attachment, the box-bounds
  branch). **Verify:** four new loop tests, one of which goes red when the gate is re-opened;
  `npm test` 1093 pass / 0 fail. *Done 2026-09-16.*
- [x] **Rearrange the landing entry** (Fabio, 2026-09-16): the chat shipped as a full-width band
  between headline and stats foot, so it lay across the crew stage and its `pointer-events: auto`
  ate every character's hover, with its own mascot on top of theirs. Now a corner panel on the
  right, lifted clear of the heads, mascot and label on the box. **Verify:** hit-test 180 points
  across the five characters — 0 land on the panel, 66 did with the old layout. *Done 2026-09-16.*
- [x] **Wire it end to end with no GPU spend.** `npm run app:isolated` (its own port and profile,
  never `:3000`): a real conversation lists models, reads knowledge, and on the landing page with
  no project asks for one before generating. **Verify:** `app.log` `[agent]` lines and the captured
  SSE events; `/agent/history` shows the tool calls in order. *Done 2026-09-16; it found two real
  defects (Electron `NO_KEY` with the env key, and invented project paths), both fixed and covered —
  see `validation.md`. The `/connector/*` empty-body re-probe rode along.*
- [ ] **The harness.** Ownership: `scripts/agent-test.mjs` (new), `tests/fixtures/agent/**`
  (new), `package.json` (one `agent:test` line). The real loop against fake tools (canned models,
  descriptions, boxes, refusals); the nine cases in brief § Testing; each run 3 times; graded by
  exact assertions on tool calls, never a judge; cost per run from `usage`. **Verify:** 9 of 9
  cases pass 3/3 on the orchestrator; each case's assertion is proven to bite (flip its fake ->
  red); cost per typical session recorded in `validation.md` beside the command. A case that fails
  its 3/3 -> pick the next candidate with Fabio (Qwen 3.8 27B is ~14x the output cost, so it is
  his call).
- [ ] **Prompt quality sample.** Five generate prompts from the harness into
  `research/prompt-samples.md`, each run through the recipe mechanical checks already in
  `scripts/recipe-test.mjs` (word budget, no placeholders). **Verify:** the file exists with
  pass/fail per sample; Fabio reads it.

## Phase 4: Live on the GPU

*Sequential, GPU lease held. Verify mode: auto. Open every artifact; a green log is not an image.*

- [ ] **Measure the describer's box answer, then build the parser.** Three real Vision outputs
  with a person; ask for the head box; record the raw answers in `research/box-measurement.md`;
  choose the parse and coordinate space from the evidence; implement it in the describe route.
  **Verify:** a unit test replays the recorded raw strings; the mapped box drawn on each original
  image is opened and inspected.
- [ ] **Real generations through the agent.** t2i (turbo), t2v (medium + turbo), i2v with an
  attached image, an edit with a reference image, Head Swap with boxes from `look`. The agent keeps
  talking while each runs; the result posts back; it looks at every image result. **Verify:** each
  output opened (images read, video frames sampled); the cards exist in the project;
  `/agent/history` shows a `look` after each image result and no unrequested regeneration.
- [ ] **Install, live, in a sandboxed store.** The smallest not-installed model: the card shows
  the size; No starts nothing; Yes downloads, then a real re-read shows it installed. **Verify:**
  downloads status and a models re-read before and after, both paths.
- [ ] **Compaction, live.** A profile with a small context window crosses its trigger; the handoff
  carries the five fields; the next reply still knows the goal. **Verify:** `/agent/history` shows
  the handoff; the mascot showed "compacting".
- [ ] **Honest limits, live.** "Watch this video" -> the limit, in character; a describer refusal
  (fake, until MPI-737 has a cloud backend) -> says so and names the Image descriptions setting.
  **Verify:** the transcript lines, pasted into `validation.md`.

## Phase 5: Fabio's pass

*Verify mode: user-ux.*

- [ ] **Fabio drives the agent in his own app.** A plain "do X -> see Y" checklist in
  `validation.md`, one action and one result per line. **Verify:** his confirmation recorded.

## Plan Drift

- 2026-09-16 (Phase 3a-3c, session 7ab56409): (1) **Attachments were staged twice** — the route
  saved them for its own reply and `runTurn` saved them again, so the chat and the model held
  different ids for one picture. The route now passes its staged records in and the loop registers
  them; found while building the trust boundary, folded into it. (2) The box-bounds branch was
  **dropped rather than rebuilt** (see Current State item 3). (3) Fabio's landing rearrange was
  folded into this card: same surface W4 built, and the defect was W4's full-width band. (4) The
  wiring run added two fixes the plan did not foresee: the endpoint key now falls through to
  `DEEPINFRA_API_KEY` inside Electron as well (the `routes/llm.js` order), and the system prompt
  carries a Project rule, because the model invented folder paths rather than asking.

- 2026-09-15 (contract written): three refinements, all recorded in `docs/agent-chat.md`.
  (1) Flow box `params` stay inside the image **unless the step declares `overflow: 'allow'`**
  (both Head Swap steps do), not always. (2) `POST /agent/message` carries the renderer's open
  `project` at send time: the server holds no open-project state, and staging plus `NO_PROJECT`
  need it. (3) The describer question is ONE retitle (node 38 -> `Input_Describe_Prompt`) and the
  route injects a whole ChatML string, the `llmService.js` `Input_System_Prompt` precedent; no new
  graph nodes, and no injection keeps today's caption byte for byte.
- 2026-09-15 (Batch 1 dispatch, session 5be4be69): (1) **MPI-766 closed** (card `done`, claim
  `766c1a1e` `complete`), so W4 got the landing slot after all. (2) W3 writes the agent pick and
  W4 reads it, which would make one worker depend on the other. The orchestrator added
  `Storage.getAgentPrefs()/setAgentPrefs({profileId, mode})` (`js/core/storage.js` +
  `STORAGE_KEYS.AGENT_PREFS`, default `{profileId: 'deepinfra', mode: 'auto'}`) before dispatch,
  so both import an existing helper. (3) The fork-bridge handler and `ipcMain` channels both live
  in `main/secretsStore.js` (no preload whitelist), so W3 owns both ends. (4) MPI-677 has no live
  session; message `b59959d0` names the shared paths for whoever resumes it. (5) Workers write no
  `state/` records (four agents writing `index.json` at once would race); the orchestrator wrote
  one claim per worker and files any blocked-file messages at integration.

## Verification

**Verify mode:** user-ux (Phase 5). Phases 0, 3 and 4 and Batch 1 self-verify (`auto`); D1-D3
are settled.

Done when: every brief item 1-15 has a line of evidence in `validation.md` (the command that ran,
or the observation, beside it); the harness passes 9 cases 3/3; `connector-manifest.json` lists
only served capabilities and `npm run build:portable:dry-run` passes its assert; Fabio's pass is
recorded.

`mpi-execute-parallel` is for Batch 1 only. Phase 0 must land first; Phases 3-5 share one app
instance and one GPU.

## Preservation Notes

- `research/investigation.md` keeps the seven wrong investigator claims visible so they do not
  come back through a later brief.
- The probe script lives in a session scratchpad that expires; its command and every number are in
  `research/investigation.md`.
- At close: `docs/agent-chat.md` rewritten to current truth; `docs/README.md` routes it;
  `.claude/skills/cubric-vision/generating.md` carries the new routes. New components and events
  change the wiring maps: **ask Fabio before touching `.claude/rules/`** (component-mounts,
  component-events).
- Events to append at close: **MPI-737** (the describe route exists; its cloud backend plugs in
  behind it; question, crop and box are built), **MPI-766** (where the landing entry mounts),
  **MPI-593** (the new connector routes are the CLI surface).
- MPI-677's inherited item (the manifest's four capabilities) closes here; note it on MPI-677's
  checklist line at close.
