# MPI-774 - In-app agent, slice A

## Current State

**Project mode:** scalable-foundation. **Spec:** `brief.md` (every product decision is Fabio's,
2026-09-15). **Parent:** MPI-677 (umbrella, `doing`, only Fabio's user-ux passes left).
**Evidence behind this plan:** `research/investigation.md` - verified facts with file:line, the
seven investigator claims that turned out wrong, and a live orchestrator probe.

**Phase 5 round 1 is IN (2026-09-18, session fa18265c).** Fabio drove the agent in his own app and
pasted the transcript; five fixes are folded in under Phase 5 (model priority as a RANKED list per
task, the head-swap box/square guard, cream instead of rose, the Remote panel loading state, memory
saved without being told). **He still owes the ranking ORDER**, and his memory test (restart, then
ask about John) is running. Nothing of those five is built yet.

**Phase 4 DONE (2026-09-17 ~15:10Z, session fa18265c; evidence `validation.md` § Phase 4 close).**
Compaction live on Qwen2.5-72B (32k): handoff with the five fields, the SSE pair, the goal recalled
after its turn was dropped. Live defect fixed: the restart kept 4 turns whatever their size, so every
later turn compacted again; it now keeps the newest turns that fit in half the trigger (unit test +
bite; live re-run: plain turns at ~4.5k, no re-compaction). Honest limits live: "watch this video"
(no tool, says it), and a REAL Remote refusal (Llama-4-Scout, "Identify this person by name.") ->
says it refused and names the setting. **Next: Phase 5**, Fabio's pass, checklist at the end of
`validation.md` (he must fully restart his app first). **Uncommitted:** `services/agentLoop.mjs`,
`tests/agent-loop.test.cjs`, `docs/agent-chat.md`, this card's files. **Close-out still owes:** the
agent release note in `docs/releases/UNRELEASED.md`; root `events.jsonl` lines for Phases 3c/3d/4 (the
root file is under live MPI-532 / MPI-800 claims today); Fabio deletes `K:/mpi774-install-sandbox`
(29 GiB), the "MPI-774 agent test" project and the scratch profiles. My boot put MpiNodes `cff4c3b3`
into the shared engine early (MPI-800's pin; message `b800d1f7`).

**Handed off (2026-09-17 ~14:15Z, session 047d6088, committed at handoff a49e6ac9):** Fabio passed
the Studio-head toggle (Phase 3d closed but item 5, deferred) and KEEPS the Klein encoder borrow on
ComfyUI enhance. Phase 4 left: compaction live, honest limits live, final harness 3x + bite, then
Phase 5. Details below.

**Earlier (2026-09-17 12:25Z, session 047d6088):** item 6's second pass is BUILT
(Studio robot head, `assets/mascot/studio/logo.webp`, as tall as the Enhance button; `validation.md` §
"item 6, second pass"). **Phase 4 is running** on my own
`app:isolated` (port changes per restart; profile in the session scratchpad; a server-side edit needs
a restart of MY instance, kill the listener's PARENT): person images done, box measurement + parser
done, two live defects fixed (ComfyUI describe question never carried the image; an empty text-op
answer hung every caller). Head Swap: first try guessed boxes -> box gate + Box rule + `square` +
labelled flow fields; second try measured and swapped cleanly. Edit with a reference: first try used
an earlier turn's "picture 1" -> numbered attachment lines + Numbering rule; second try right. Enhance
VRAM DONE (nothing resident between prompts; the Klein encoder borrow and `Replace Text.replace` never
reached the graph -> `canonicalizeInjectionKeys` keeps dotted bare keys, fixed live). H3 t2v right
(medium + turbo); H3 i2v framed a portrait start frame at 16:9 -> attachment/result sizes + a ratio
sentence; the i2v rerun kept the head (9:16). Install DONE on a seeded K: sandbox (engine AND models
root; `CUBRIC_MODELS_ROOT` alone does NOT sandbox, the engine's `model_roots.json` wins): the Yes call
no longer holds the whole download, the re-read reads `installed`, the result says "the user pressed
Yes ... downloading". Harness after the rule edits: 15/15 bites, 3x 14/15 (`memory-read` flake, 6/6
alone). **Left in Phase 4:** compaction live (`model: Qwen/Qwen2.5-72B-Instruct`, 32k window, tools OK
but ~87 s a call; run it on my instance, `drive.mjs` in the scratchpad), honest limits live ("watch
this video"; a real Remote refusal if one comes cleanly, else the harness fake), then a final full
harness 3x + `--bite` (the prompt moved again: install result text, ratio sentence), `npm test`,
lint, the agent-chat desktop spec (private `--output`). **Uncommitted:** everything this session.
Leave for Fabio: `K:/mpi774-install-sandbox/` (29 GiB), the scratch profiles, the "MPI-774 agent
test" project.

**Where it stood (2026-09-17 ~13:00Z, session d56a1cbe, committed at handoff):** Phase 3c CLOSED;
Phase 3d items 1-4, 6, 7 built, bitten and **passed by Fabio in his app** (agent box, numbered chips,
full-height resizable panel; an agent edit's card now has the right shape). Item 5 waits for the
mascot animations. **Next, in order:** (1) **item 6 has the WRONG HEAD and is TOO SMALL** (Fabio): the
toggle must show `C:\AI\Mpi\Cubric Studio Brand Assets\Studio-Logo.png` (the robot face, 2000x2000, not
in the repo yet), not the Vision camera (`assets/mascot/logo.png`). Add a small web-sized copy under
`assets/mascot/` (a ~128px webp), point the toggle's `image` at it, and make it about the size of the
Enhance button beside it (today the image takes the `sm` 16px icon size). Update the src in
`tests/desktop/agent-chat.spec.js`, `docs/agent-chat.md` and `.claude/rules/component-mounts.md`. A
reload shows it. (2) Phase 4 (GPU, option A, lease), which now also carries MPI-677 step 1d (ComfyUI
enhance VRAM, message `f82e6bea`). Fabio: keep MPI-797 on the board; "yes to maps" (done); no gallery
entry for `MpiResizeHandle`.

**Before that (2026-09-17 09:48Z, session 6fd51047, handoff 89c36b80):** Phase 3b is DONE (Fabio's "1"
after the padding fix `3dd0301a`). **Phase 3c is BUILT, committed at this handoff** (D4-D6 as
recommended; evidence `validation.md` § Phase 3c): per-project conversations
(`services/agentSessions.mjs`), the landing agent's `list_projects` / `create_project`, `open_project`
allowlisted. Unit 15/15 + 13 bites, desktop 24/24 + 6 bites, `npm test` 1264/0, harness bite 15/15,
harness 3x **14/15**. **Next, in order:** (1) `new-project-brief` is 2/3: after the brief note the
agent generated a first shot unasked; tighten the Project rule's goal branch ("then ask what to make
first; generate only when asked") and rerun that case `--runs 3`, plus the full 3x if the rule text
moves. (2) Fabio's landing-page check (a FULL app restart: the change is server-side). (3) Ask Fabio
before updating `.claude/rules/` component maps (new `agent:session` event, `session` on every
`agent:*` payload, `MpiAgentChat` now listens to `project:changed`). (4) Phase 4 with **option A**
(details under Phase 4). **Before booting any app for Phase 4**, run `git status -- routes/ server.js
services/ main/`: an app instance loads peers' uncommitted server code against the REAL engine and
model roots. MPI-656 Phase 1 is committed (`620627d3`); on 2026-09-17 MPI-532 had an uncommitted
`routes/downloadManager.js` edit that only ADDS GC protection (installed Flow packages), judged safe.
Ask Fabio before touching `.claude/rules/` for the new `agent:session` event. The older note below is
kept for its detail.

**Earlier (2026-09-16, session 105b3570, handed off):** Phase 3b is BUILT, VERIFIED and
COMMITTED (evidence: `validation.md` § Phase 3b): items 1, 2, 4, 5 done; **item 3 (panel below the
topbar, 420px) waits only on Fabio's eyes** (reload his app, toggle Agent mode, look at the panel
under the "<- PROJECTS" row). Harness 13/13 x3, every flip bites; H3 samples 150/190 words with shot
structure and sound. **Next:** get Fabio's item-3 verdict (and let him read
`research/prompt-samples.md`), then Phase 4 (live on the GPU, lease). Server-side changes need an
app RESTART in Fabio's app, not a reload. Fabio's user-ux pass (Phase 5) must also cover the gallery
panel, the toggle position, the landing box, Settings > Remote > Language Models, and the new
"Noted:" line / `<project>/Agent/` notes.

**Harness design (settled, e0fe3905):** `scripts/agent-test.mjs` drives `AgentLoop` with the REAL
`DeepInfraEngine` and fake tools built from `tests/fixtures/agent/` (the real `/connector/models` and
`/connector/knowledge` payloads captured from an isolated instance). Assertions read the model's own
calls from `loop.getHistory()` (`kind: 'tool'` / `'confirm'` entries), never the fakes' internal
calls (the install card reads list_models itself). A `--bite` pass runs each case once with its flip
and expects FAIL. Cost = summed `usage` x the model's live DeepInfra price.

**Previous session (7ab56409):** Phase 0 and Parallel Batch 1 are done, verified
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
- [x] **Shared LLM connection** (Fabio via coordinator message `b5952029`, 2026-09-16; reply
  `0fb6f49d` to MPI-737 carries the contract). A profile becomes a connection only
  (`{id, name, baseURL}` + URL-bound key); the per-job model leaves it (agent model -> agent prefs);
  one shared connection pref. Job-agnostic `POST /llm/connection/probe` and
  `GET /llm/connection/models?profileId=` (recommended first, `recommendedFor[]`) in
  `routes/llm.js`; `RECOMMENDED_REMOTE_MODELS` in `services/llmEngines.mjs` (exact ids per preset;
  MPI-774 fills `agent`). Settings: connection block at the top of Language Models; Agent row =
  "Remote" + model dropdown ("(recommended)" first) + mode. NOT touched: the DeepInfra-only key
  field, the `'deepinfra'` backend value, the Enhancement/Descriptions rows (MPI-737). Done
  BEFORE the harness, because the loop reads the profile. **Verify:** secrets + llm-service +
  agent-loop tests green; a route test for both new routes with a fake endpoint; the agent loop
  resolves its model from prefs, not the profile.
- [x] **Gallery agent panel** (Fabio, 2026-09-16). The toggle moves to the first slot of the bottom
  row (after the text field, before the expand button). The drawer over the prompt box goes. In
  Agent mode a shell-level panel on the LEFT fills from under the topbar down to the prompt box and
  pushes the workspace right; the image-chip strip still paints over it. It holds only user
  bubbles, agent replies and the images sent. The prompt box sends its image chips as attachments.
  Also: history replay read `entry.role`, the loop writes `entry.kind`, so a remount rendered an
  empty transcript - fixed here. `MpiGalleryBlock.js`/`MpiGalleryGrid.js` are MPI-770's (claimed):
  the panel lives in the shell, never in the block. **Verify:** agent-chat desktop spec extended
  (panel shown only in Agent mode, cards pushed right, history survives a remount);
  `lint:components` clean.
- [x] **Agent state on the event bus** (Fabio, 2026-09-16): the mascot animations are a later card,
  but they need triggers now. `agentService` owns ONE `/agent/stream` and re-emits every
  `agent:*` SSE event on `Events` (`MpiEventMap` entries), so any component subscribes without
  opening its own stream. The mascot art itself is out of scope. **Verify:** unit test on the
  forwarder; the chat consumes the bus, not its own EventSource.
- [x] **Landing: agent box beside the headline** (Fabio, 2026-09-16): out of the crew corner, into
  the empty space right of "Generate. Refine. Own it.", refined with the impeccable skill.
  **Verify:** screenshots on an isolated instance; the 180-point crew hit-test still 0.
- [x] **The harness.** Ownership: `scripts/agent-test.mjs` (new), `tests/fixtures/agent/**`
  (new), `package.json` (one `agent:test` line). The real loop against fake tools (canned models,
  descriptions, boxes, refusals); the nine cases in brief § Testing; each run 3 times; graded by
  exact assertions on tool calls, never a judge; cost per run from `usage`. **Verify:** 9 of 9
  cases pass 3/3 on the orchestrator; each case's assertion is proven to bite (flip its fake ->
  red); cost per typical session recorded in `validation.md` beside the command. A case that fails
  its 3/3 -> pick the next candidate with Fabio (Qwen 3.8 27B is ~14x the output cost, so it is
  his call).
- [x] **Prompt quality sample.** Five generate prompts from the harness into
  `research/prompt-samples.md`, each run through the recipe mechanical checks already in
  `scripts/recipe-test.mjs` (word budget, no placeholders). **Verify:** the file exists with
  pass/fail per sample; Fabio reads it.

## Phase 3b: Fabio's round (2026-09-16, before any GPU)

*Fabio, after reading the Phase 3 report. Verify mode: auto, except item 3 (`user-ux`).*

**Fabio's answers (2026-09-16, session 105b3570), they override the item text below:**
- **Item 1 covers the IN-APP agent only.** External CLI agents and the external skills KEEP the
  delete routes: "that's usually used by more powerful agents with a lot of tooling ... it's the
  user's responsibility, and the user might just want ... 'Save the media and delete the projects
  once you're finished'". So: no skill edits for deletion; the in-app tool table and the calls
  `agentTools.mjs` can make are pinned by a test; the system prompt and `docs/agent/*` carry the rule.
- **Item 2, the skill packs: option (a).** Vendor packs live ONLINE (locations per model in
  `docs/recipes/research/<id>/sources.md`; content deliberately not stored, Fabio 2026-08-17). We
  write our OWN refined guide per shipped model in `docs/agent/models/<model>.md` (ships, `docs/` is
  not excluded), distilled from the vendor pack + our recipe + `docs/models/<model>/` + field
  evidence, each citing its sources, no vendor text copied.
- **Item 5: build it in this card** (reverses brief item 14's "gone on restart" and the "memory
  across restarts" out-of-slice line). Design as proposed, not objected to: `<project>/Agent/`,
  `README.md` index (one line per note) + one `.md` per note; the index enters the first turn with
  that project (and after a switch); tools `read_memory` / `write_memory` over
  `GET/POST /connector/memory` (CLI agents get them too); slug file names resolved inside `Agent/`
  only; update allowed, no delete; caps 4 KB per note, 100 index lines, else `MEMORY_FULL`; a
  "Noted: <title>" status line on each write; no in-app viewer in this card.

**Progress (session 105b3570, committed at its handoff):**
- Item 1 built: deletion rule + honest limit in the prompt, `docs/agent/gallery.md` row,
  `tests/agent-no-delete.test.cjs` (tool names, invented tool refused, prompt rule, and an
  ALLOWLIST of every request `agentTools.mjs` can make); 5 mutations all red, bytes restored.
- Item 3 built: `#agent-panel-mount` margin-top 52px (was padding) and 420px; the real-panel
  spec asserts width 420 and top >= topbar bottom (both mutations red). Screenshots on an
  isolated instance (`:53030`, scratch project). Waiting on Fabio's eyes.
- Item 4 done: component-maps worker, HEAD-only reads, 4 files (+39/-2), LF verified by me.
  It found `gallery:open-card` had NO listener: fixed (shell listener in `agentPanel.js`,
  declared in `js/events.js`, spec with a recorded navigate), map line corrected.
- Item 5 built: `services/agentMemory.mjs` + `/connector/memory` routes, tools
  `read_memory`/`write_memory` (open project only), notes index opens the first turn per
  project, "Noted:" label; `tests/agent-memory.test.cjs` 9/9, loop block (h).
- Item 2 in progress: corpus kinds `guide` + `skill` (+ `copyAgentSkills` build step, since
  `.claude` is not in the portable build), `guides` + per-model `media` roles on
  `/connector/models`, the GUIDE_NOT_READ gate, `rename_card` + `cardName`, H3 guide written;
  8 guides by 4 workers, all reviewed and corrected by me (SDXL's labelled blocks, Klein t2i
  media, mask ops, neutral wording). Harness: live corpus, 4 new cases; the knowledge fixture is
  gone (unused). DONE: 13/13 x3, --bite 13/13, samples rerun after swapping two guide examples
  that WERE sample requests (the agent had pasted one verbatim). `list_models` ops also carry
  per-model `media` roles now.
- Found and fixed on the way: a finished generation pushed a user message into the context
  the moment it settled, which can land between a tool call and its result mid-turn (a
  provider 400). Now queued and sent at the start of the next turn, failures included.

- [x] **1. Agents never delete.** "Only the user can delete cards and projects." Today the loop's tool
  table has no delete, but prove it and make it structural: sweep `routes/connector.js`,
  `services/agentTools.mjs`, `js/shell/agentDispatch.js` capabilities and the CLI skills
  (`.claude/skills/cubric-vision*/`) for any delete/remove/trash path an agent can reach; add a test
  that fails if a delete-shaped tool or connector route appears; state the rule in the system prompt
  (refuse and tell the user to delete it themselves) and in `docs/agent-chat.md` + the skills.
  Note: a CLI agent can still call raw app routes (`DELETE /project-media/...`); say so honestly and
  decide with Fabio whether the connector surface is the enforced boundary.
- [x] **2. The agent uses skills, not only recipe briefs.** Fabio: "we have skills to work with
  Cubric-Vision, are we not giving that to the agent?", and "models bring their own skill packs;
  we could create refined skill sets per model". An agent should ADAPT prompts with its own knowledge
  and the model's guide; a recipe used verbatim will not reach what the user wants. Today the corpus
  (`services/agentCorpus.mjs`) serves recipe briefs (`kind:'model'`) + `docs/agent/*.md`
  (`kind:'app'`) + `app:operations`. Plan: add a `kind:'skill'` family from the Vision skills
  (`.claude/skills/cubric-vision*/SKILL.md` + their linked files) and per-model skill files;
  give each model in `list_models` its guide ids; require a read before the first prompt for a
  model (structural, like the install gate if a rule alone does not hold). **Open question for
  Fabio:** where do "models' own skill packs" live? `grep -i "skill.?pack"` finds only the kanban
  plugin; candidates are `docs/models/<model>/` (e.g. `h3/`, `ltx/prompt-contract.md`) and the
  create-enhancer-recipe output. Ask before designing. Re-run `--samples`: the H3 prompts (44/46
  words vs a 50-400 floor, no shot structure, no sound) are the measured baseline to beat.
- [x] **3. Panel layout (user-ux).** The left panel covers the workspace topbar (project name,
  "<- PROJECTS") because `#agent-panel-mount` starts at the top of `.workspace-content` and only pads
  52px. Start it BELOW the topbar and the nav chips so they keep their own area, and widen it by
  100px (320 -> 420, `styles/shell/workspace.css` `#agent-panel-mount.agent-panel-mount--open`).
  Verify: the real-panel desktop test (width assertion) + a screenshot for Fabio.
  **Fabio 2026-09-16:** position OK (his screenshots); "the chat window should have some padding so
  that the letters are not straight up touching the edges" -> fixed in `MpiAgentChat.css`
  (`#agent-panel-mount` transcript `padding-inline: var(--s-3)`, the header's gutter), awaiting his reload.
  **Closed 2026-09-16 ~14:30Z:** Fabio answered "1" (looks good) after that commit.
- [x] **4. Update `.claude/rules/`** (Fabio said yes, 2026-09-16): the component maps for the new
  wiring (events `agent:*` + `agent:send`, state `agentMode`, the `#agent-panel-mount` shell mount,
  `MpiAgentChat` bus subscription, `MpiLlmSettings` connection block). Use the
  `mpic-update-component-map` skill, not hand edits.
- [x] **5. Per-project agent memory.** Fabio: a folder in the project where the agent keeps Markdown
  memory; on opening a project it reads an index (`README.md`/`agents.md`) that points at note files,
  one per thing it learned working on that project. Design first (decide with Fabio): folder name
  and place (precedent: `project.md` and card notes, `.claude/skills/cubric-vision-project-files/`),
  when it is read (project open / first turn, via the app-state line), tools (`read_memory`,
  `write_memory` scoped to that folder only; NO delete, item 1), size caps, and whether the user sees
  it in the app. Writes go through a route, never a direct `fs` write from the loop.

## Phase 3c: One conversation per project, and the landing agent's jobs (Fabio, 2026-09-16)

*Taken by MPI-737 session 5da6c574 from Fabio's feedback. Verify mode: auto for the code, user-ux for
the end check. **Built 2026-09-17 by session 6fd51047** (evidence: `validation.md` § Phase 3c).*

**Fabio's answer (2026-09-17, session 6fd51047): "go"** to "go, all recommended", so D4-D6 are as
recommended below.

**As built:** `services/agentSessions.mjs` holds the conversations (a module, not a Map inside the
router, so D4/D5 are unit-testable); `projectKey` (`agentLoop.mjs`) is the one key function. D5 also
covers a PROJECT conversation opening another project: it carries, never moves. `open_project` is
structural like `_images`: only a folder `list_projects`/`create_project` gave, the open project, or
one the user typed (`UNKNOWN_PROJECT`). Two chat defects found and fixed on the way: a 200 reply with
`ok: false` (BUSY, NO_PROFILE) left the chat "working" forever, and a failed generation rendered
`[object Object]`.

Fabio, verbatim in intent: "each project has its own [short] recall ... if I change to another project, I
don't want to see the same conversation ... I'm not saying unload the model". And on the landing page
the agent should: create or open a project; on "create an image" with no project, make one (named
"New Project" or similar) and generate there; on "let's start a new project, the goal is X", create it,
open it, and start a memory file about the project.

**Facts (checked 2026-09-16):** `routes/agent.js` holds ONE `AgentLoop` (`defaultLoop`,
`services/agentLoop.mjs:989`); its state is all per-conversation (`_messages`, `_history`, `_images`,
`_groups`, `_notes`, `_notesProject`, `_readIds`, `_pendingConfirm`, `_working`) plus the SSE
`_subscribers`. `POST /agent/message` already carries `project`. `open_project` exists
(`/connector/open-project`), user-given path only (prompt rule, `agentLoop.mjs` ~450). Projects are
created by `POST /create-project { name, folderPath? }` (`routes/projects.js:769`: default root
`getProjectsRoot()`, a taken name gets `_<8 hex>`, writes `project.json` + `project.md`) and listed by
`POST /list-projects` (`:820`). Neither is a connector route or an agent tool. The renderer's
project switch is `project:changed` (`js/events.js:126`).

**Decisions for Fabio (recommendations first):**
- **D4 - One turn at a time, app-wide?** Recommended: YES. `BUSY` stays global: one model conversation
  runs at a time; a turn started in project A finishes in A's transcript even if you switch to B.
  Alternative: a turn per project in parallel (more spend, more edge cases).
- **D5 - The landing chat opens or creates a project: where does the conversation go?** Recommended:
  it MOVES into that project when the project has no conversation yet (always true for a new one), and
  the landing chat starts fresh. An existing project keeps its own conversation; the agent carries your
  request over in one line. Alternative: the landing conversation stays on the landing page.
- **D6 - Does a project's conversation survive an app restart?** Recommended: NO, as brief item 14
  says; the `<project>/Agent/` notes are the memory that survives. Alternative: save it in the project.

- [x] **A. One conversation per project.** Server: `routes/agent.js` keeps a `Map` of loops keyed by
  the project's `folderPath` (`''` = the landing page); `/agent/message` routes by `project`;
  `/agent/history`, `/agent/reset` take `?project=`; `/agent/confirm` and `/agent/attachment/:id` find
  the owning loop; `/agent/probe` stays loop-free. ONE `/agent/stream` for all: the subscribers move to
  the router (one broadcaster handed to every loop) and every event carries its `session` key.
  Attachments: a reset wipes only that conversation's files. Renderer: `agentService` sends, reads
  history and resets with the key (open project, or `''` on landing); `MpiAgentChat` ignores events of
  another session and re-renders from history on `project:changed`. D4/D5/D6 as answered.
  **Verify:** unit test, two projects keep separate histories and `BUSY` follows D4; desktop spec,
  switch project -> empty transcript, switch back -> it returns; landing and project chats differ;
  `npm test`, `npm run agent:test` 13/13.
- [x] **B. The landing agent's project jobs.** Connector routes `GET /connector/projects` (over
  `/list-projects`) and `POST /connector/create-project { name }` (over `/create-project`, default root
  only, never overwrites), and tools `list_projects` / `create_project`. `open_project` then takes a
  path from `list_projects` or from the user, never an invented one. Prompt rules: open by name; "make
  X" with no project -> create "New Project" (a taken name gets the route's suffix), open it, generate;
  "start a new project, the goal is X" -> name it from the goal, create, open, then `write_memory` a
  project-brief note (goal, look, decisions so far). No delete anywhere: extend
  `tests/agent-no-delete.test.cjs`'s allowlist by exactly these two routes. Docs: `docs/agent-chat.md`
  tools + routes, `resources/cubric/connector-manifest.json` if it lists routes.
  **Verify:** route tests (create never overwrites, list returns folderPaths); harness +3 cases (open
  by name, create-then-generate, new project with a brief note), each with a `--bite` flip; then
  Fabio on his landing page. *Auto part done 2026-09-17; `create-then-generate` REPLACES the old
  `no-project` case (the landing agent no longer just asks), so the harness has 15 cases. Open: Fabio's
  landing-page check (needs a full app restart).*
  *2026-09-17 (session d56a1cbe): harness `new-project-brief` was 2/3 (a first shot generated
  unasked after the brief note); the goal branch now ends by asking what to make first.*
  **CLOSED 2026-09-17:** Fabio's landing check "Everything worked nicely"; his screenshots' three defects
  (broken result image, invisible list numbers, a carried request confusing its new chat and missing its
  bubble) and the harness's `install-asks` guessed-id card are fixed (`validation.md` § Phase 3c close).

## Phase 3d: The agent box (folded from MPI-797, Fabio 2026-09-17)

*Fabio, 2026-09-17: "make sure 797 is part of our work". MPI-797 (`todo`, `blocked` on Phase 3c,
which is committed in `4ee23d00`) stays on the board as the record of the ask; its work lands here.
Same files as Phases 3b/3c: `MpiAgentChat`, `js/shell/agentPanel.js`, `js/services/agentService.js`,
`MpiPromptBox`. Verify mode: auto for the code, user-ux for the end check (folds into Phase 5).*

- [x] **1. Input hint.** In Agent mode the input says how to use it, e.g. "Talk to the agent.
  Shift+Enter for a new line, Enter to send."
- [x] **2. An agent box (D7).** Consider swapping the whole prompt box for an agent box that holds only
  the text input and the Agent|Prompt toggle. **Fabio, 2026-09-17: as recommended** - no new component:
  in Agent mode the existing prompt box (it already sets `mpi-prompt-box--agent-mode`) shows only the
  input, the image chips and the toggle.
- [x] **3. Dropped images attach to the next message.** Chips optional; numbered 1, 2, 3 only, never
  "start frame" / "last frame" / "picture 1".
- [x] **4. The side panel.** Resizes by dragging its edge, runs full height down to the status bar, and
  pushes the prompt input right so it never covers the agent text.
- [ ] **5. Remote image description progress** (folded into MPI-797 by MPI-737's close-out, Fabio
  2026-09-17, `2ab67359`): a Remote describe shows no progress (a ComfyUI one shows in the status bar);
  give it visible progress, "using one of the mascot animations once they exist". **DEFERRED (Fabio,
  2026-09-17): wait for the mascot animations**; they will also play in the agent chat (thinking,
  generating). The agent's triggers already exist: `agent:working` (thinking), `agent:tool` with
  `tool: 'generate'` (generating), `agent:result`, `agent:compacting`.
- [x] **6. The toggle is the agent's head** (Fabio, 2026-09-17: "our agent logo ... only the head").
  `MpiButton` gained an `image` prop (icon mode with an `<img>`: muted until hovered, full colour when
  active). **Second pass (Fabio: wrong head, too small):** the toggle shows the Studio robot,
  `assets/mascot/studio/logo.webp` (trimmed 128px copy of `Studio-Logo.png`), and an image button at
  `sm` drops its padding so the image is as tall as the Enhance button (`mpi-ibtn--image`).
  Not added to the components gallery (Fabio).
- [x] **7. An agent edit's card had the wrong shape** (Fabio's screenshot: Klein edit, 1:1 card, portrait
  image; the sidecar said 1024x1024, the file is 832x1248). `resolveNamedParams` injected the project's
  saved ratio on ops that size their own output (`imageSizedOps`), which the PromptBox never does; the
  server trusts client Width/Height, so the card took the wrong size. Now skipped there.
  **Verify:** desktop spec per item with a bite; then Fabio in his app (a reload, renderer-only).
  *Items 1-4 built and bitten 2026-09-17 (code checked; Fabio's eyes still open, in Phase 5 at the latest).*

**Design (2026-09-17, session d56a1cbe, from a read-only scout):** Agent mode keeps its OWN text
(`agentValue`; before, sending wiped the saved positive prompt through `_writeMode('')`), placeholder =
the hint, the ref picker off, and Ctrl+Enter no longer generates (`_triggerRun` never checked the mode).
The grid collapses to `1fr auto` so hiding slots cannot shift the textarea. Chips: images only, up to 9,
no op up-jump, badge = position always (never a slot tag or a frame pill), `_chipKey` carries the mode
so the toggle repaints; leaving Agent mode fits the chips back to the op (up-jump, else trim the tail;
a model with no image slot prunes them). Panel: a direct child of `.main-area`, absolute from the
topbar to the status bar, width `--agent-panel-w` (stored, clamped, at most half the area); the
workspace, prompt box and controls take the same `margin-left` through `:has()`. No splitter existed:
a new Primitive `MpiResizeHandle` (pointer capture; `resize-start` / `resize` / `resize-end`).

## Phase 4: Live on the GPU

*Sequential, GPU lease held. Verify mode: auto. Open every artifact; a green log is not an image.*

**Where it runs (Fabio, 2026-09-16: option A).** My own `npm run app:isolated` with the real engine
root, attached to the engine his app already runs (48188); never `:3000`. Every command that
dispatches (the agent's `generate`, a ComfyUI `look`) runs inside `gpu_lease.py run` and waits for its
job to settle, because the lease lasts only as long as the command. His app is untouched. The scratch
project "MPI-774 agent test" lands in HIS projects root (`APP_DOCUMENTS` is not profile-scoped); he
deletes it. The install item runs on a second isolated instance with a scratch `CUBRIC_ENGINE_ROOT`
and `CUBRIC_MODELS_ROOT` on K:, seeded so the boot repair downloads nothing (memory
`tool_sandbox_isolated_app_seed_uw_deps`).
**Order:** the person images first, then box measurement on them, then the parser, then the rest
(Head Swap last, since it uses the boxes).
**Two describers.** `look` now goes through `llmService.describeImage` (MPI-737, `2f33601c`), which
runs the Image descriptions pick: Remote (a DeepInfra vision model via `POST /llm/describe`, no GPU)
or ComfyUI (Qwen3-VL 4B, `image_descriptor.json`, GPU). Measure and parse both.

- [x] **Measure the describer's box answer, then build the parser.** *(2026-09-17, 047d6088: both
  describers answer RELATIVE; `boxFromDescribeAnswer` in the route; two live defects fixed on the way,
  see `validation.md` § Phase 4.)* Three real Vision outputs
  with a person; ask for the head box; record the raw answers in `research/box-measurement.md`;
  choose the parse and coordinate space from the evidence; implement it in the describe route.
  **Verify:** a unit test replays the recorded raw strings; the mapped box drawn on each original
  image is opened and inspected.
- [x] **Real generations through the agent.** *(2026-09-17, 047d6088: all five, each after a live fix
  where the first try was wrong; `validation.md` § Phase 4.)* t2i (turbo), t2v (medium + turbo), i2v with an
  attached image, an edit with a reference image, Head Swap with boxes from `look`. The agent keeps
  talking while each runs; the result posts back; it looks at every image result. **Verify:** each
  output opened (images read, video frames sampled); the cards exist in the project;
  `/agent/history` shows a `look` after each image result and no unrequested regeneration.
- [x] **Install, live, in a sandboxed store.** *(2026-09-17, 047d6088: No / Yes / re-read, with two
  fixes found live: the install no longer holds the Yes call for the whole download, and the re-read
  reads `installed`; `validation.md` § Install.)* The smallest not-installed model: the card shows
  the size; No starts nothing; Yes downloads, then a real re-read shows it installed. **Verify:**
  downloads status and a models re-read before and after, both paths.
- [x] **Compaction, live.** *(2026-09-17, fa18265c: Qwen2.5-72B, 32k window; handoff with the five
  fields, `agent:compacting` on/off, the goal recalled after its turn was dropped. Found live: every
  later turn compacted again -> the restart keeps only the turns that fit; `validation.md` § Compaction.)*
  A profile with a small context window crosses its trigger; the handoff
  carries the five fields; the next reply still knows the goal. **Verify:** `/agent/history` shows
  the handoff; the mascot showed "compacting".
- [x] **ComfyUI enhance VRAM (folded from MPI-677 step 1d, Fabio 2026-09-17, message `f82e6bea`).**
  *(2026-09-17, 047d6088: no resident model to evict; the borrow never applied, fixed. `validation.md`.)*
  On the 16 GB card, under the lease: Enhance (backend ComfyUI, the default since MPI-737) ->
  generate -> Enhance -> generate from the prompt box, watching VRAM and whether the second generation
  runs cold, i.e. whether the enhancer graph evicts the resident generation models (MPI-35 phase 2
  claimed it by static analysis only; the counter-argument: the encoder is a subset of what the
  generation already loads). Certain either way: a ComfyUI enhance is a queued job and waits behind a
  running generation. **Verify:** the result in `validation.md` either way, plus a one-line pointer in
  `tasks/MPI-677/validation.md` (MPI-677 stays done; its step 1d text calling DeepInfra the default is
  stale).
- [x] **Honest limits, live.** *(2026-09-17, fa18265c: both, with a REAL Remote refusal; `validation.md`
  § Honest limits.)* "Watch this video" -> the limit, in character; a describer refusal
  (MPI-737's Remote describer exists now: use a real refusal if one can be produced cleanly, else
  the fake) -> says so and names the Image descriptions setting.
  **Verify:** the transcript lines, pasted into `validation.md`.

## Phase 5: Fabio's pass

*Verify mode: user-ux.*

- [ ] **Fabio drives the agent in his own app.** A plain "do X -> see Y" checklist in
  `validation.md`, one action and one result per line. **Verify:** his confirmation recorded.
  *(Round 1 done 2026-09-17/18: transcript + findings in `validation.md` § Phase 5 - Fabio's first
  round. His memory test - restart, then ask about John - is still running.)*

### Phase 5 fixes (from round 1, all folded into this card)

1. **Model priority, a ranked list per TASK** (Fabio: best, second, third, ... not one featured
   model). New table in `js/data/modelConstants/` keyed by task, entries `{modelId, op}` (ops are
   per-model ids); `rank` on each op in `GET /connector/models`; one Model rule line ("of the
   installed models that do this task, take the highest-ranked unless the user names one");
   `docs/playbooks/add-model` gains a step so a new model lands in the table. **Fabio still owes the
   ORDER** (candidates listed in `validation.md`). **Verify:** a harness case - an edit request with
   klein-9b and krea2 installed picks `kleinEdit` 3/3, and naming Krea 2 still wins.
2. **A head box that is not head-sized must not become a square that eats the neighbour.** Live:
   `box1 1166x1166` at `x -245` on a 1664x2304 photo, `box2 1171x1171` on a 768x1344 photo. The
   describe route returns the box's share of the image; the loop refuses a box over the share a
   head can take and asks for a tighter measure (or a crop), instead of squaring it silently.
   **Verify:** the same two photos measured again -> the left woman's square holds her head only, or
   a refusal the user can read; unit test on the recorded numbers.
3. **The agent is Studio cream, not Vision rose:** every pink in the agent chat, panel and agent box
   becomes `--hub-accent` (the token comment saying "identity only, never an action colour" moves).
   **Verify:** no `--accent-heat` left in the agent surfaces; Fabio's eyes.
4. **Remote > Language Models needs a loading state** (spinner or mascot) while the connection block
   resolves; today it shows labels with empty values. **Verify:** Fabio's eyes on a cold open.
5. **Memory saved only when told** ("Don't forget that, okay?"). Strengthen the Memory rule so a
   stated goal, character or decision is saved without the cue. **Verify:** a harness case where the
   user states a character in passing -> `write_memory` called 3/3.

## Plan Drift

- 2026-09-17 (Phase 4 close, session fa18265c): (9) live compaction on a 32k window compacted on
  EVERY turn after the first: the restart kept the last 4 turns whatever their size, and one
  `list_models` answer is ~9.5k tokens against a 16.4k trigger. The restart now keeps the newest turns
  (at most 4) that fit in half the trigger (same file, needed for the compaction item). (10) My
  `app:isolated` boot ran the node drift repair on the SHARED engine because MPI-800's uncommitted
  `node_lock.json` pin was in the tree (MpiNodes -> cff4c3b3 on disk; engine not restarted); MPI-800
  told (message `b800d1f7`), nothing reverted.

- 2026-09-17 (Phase 4, session 047d6088): live runs found four things no fake could, all folded in
  (same files as the card): (1) `buildDescribeInjectionParams` never sent the image (ComfyUI describe
  with a question answered empty); (2) an empty text-op answer left every caller waiting forever
  (`generationService` now calls `onError`); (3) the model guessed Head Swap boxes -> a box gate, a Box
  rule, `square` on the describe route; (4) `list_models` listed Flow fields as bare ids, so Head Swap's
  expression field got an instruction -> `fields: [{id, label}]`, step fields included. The box parser
  maps RELATIVE answers (measured), not the pixel case `mapFromDescribeSpace` assumed; that function is
  gone. Later the same day: (5) unnumbered attachments -> "picture 1" from an earlier turn -> numbered,
  sized lines + a Numbering rule; (6) H3 i2v framed a portrait start frame at 16:9 -> sizes + a ratio
  sentence; (7) commandExecutor's `Input_` pass renamed dotted keys, so the MPI-677 encoder borrow and
  `Replace Text.replace` never reached ComfyUI -> `js/utils/injectionKeys.js` (outside this card's
  files, but it decided the folded step 1d measurement); (8) `agent.install-model` awaited the whole
  download and the loop's re-read ignored `installed` -> fixed, result text says what happened.

- 2026-09-17 (Phase 3c, session 6fd51047): (1) the conversations live in a new module,
  `services/agentSessions.mjs`, so the router stays thin and D4/D5 are unit-testable. (2) The harness
  case `no-project` ("asks for a project") contradicted the new landing rule and became
  `create-then-generate`; `memory-write`'s flip changed from `project: null` (the agent may now create
  a project and save there) to a full note store. (3) The first harness run showed the model naming the
  project after the request ("Cat on Windowsill") and writing a brief note; the Project rule now says
  "exactly New Project" and "no note" for a make-something request, 3/3 after. Fabio said "New Project
  or similar", so a descriptive name is his call to reopen. (4) MPI-656 Phase 1 landed while this ran,
  which clears the Phase 4 blocker noted on 2026-09-16.
- 2026-09-16 (~14:40Z, session 6fd51047): (1) Fabio closed item 3 and chose option A for Phase 4
  (recorded under Phase 4). (2) MPI-737 routed `look` through the Image descriptions switch, so Phase
  4 measures both describers, and the Remote half needs no GPU. (3) Phase 4 order: the person images
  come first. (4) Phase 4 waits for MPI-656's Phase 1 (a live peer's uncommitted boot-path edits).
  (5) The autonomous dispatch check returned MPI-558, MPI-656 and MPI-715. After reading their plans,
  none was dispatched: MPI-715 needs Fabio's `raw/` edit plus GPU runs on MPI-711's Bernini graph;
  MPI-656 rewrites the model-root and download code Phase 4 runs against the real engine (a peer has
  since started it); MPI-558 alone is not a batch.
- 2026-09-16 (~13:45Z, MPI-737 session 5da6c574): Fabio gave his agent feedback in the MPI-737
  window after MPI-774's own session (6fd51047) closed with no changes. Folded in here, not a new card:
  the panel padding (item 3, fixed) and Phase 3c (one conversation per project; landing agent creates
  and opens projects). Phase 3c goes BEFORE Phase 4. MPI-737 also changed code this card reads:
  `/llm/enhance` now requires `backend`, and the `secretsClient` DeepInfra-key methods are gone (no
  agent caller used them).
- 2026-09-16 (Phase 3b start, session 105b3570): (1) `files.json` named the moved
  `cubric-vision/generating.md` (MPI-776 split it into `cubric-vision-generate/SKILL.md`): repointed,
  and Phase 3's unlisted files added. (2) **`.claude/` is excluded from the portable build**
  (`APP_COPY_EXCLUDES`), so the in-app agent cannot read `.claude/skills/cubric-vision*` in an
  installed app: item 2 needs a shipped copy. (3) MPI-776 offered `rename_card` + `cardName` on
  generate for the in-app agent (message `c2ccfb52`): folded into item 2 (it deletes nothing; the
  relay is already in HEAD). (4) **MPI-737 is live and holds `js/shell/agentDispatch.js`** (claim
  `2a0d4794`): item 2 adds guide ids in `routes/connector.js`, never in the relay. (5) The
  autonomous dispatch check selected MPI-513/512/560; none was dispatched: all three are umbrellas
  whose plans assign files per member at dispatch time, MPI-513's footprint missed its renderer
  consumers, MPI-512 needs live Pod work, MPI-560 needs Fabio's bench and open design.

- 2026-09-16 (harness, session e0fe3905): the harness found five loop/contract defects (see
  `validation.md`); fixing them grew the card into `js/data/generationControls.js`
  (`namedParamsFor`), `js/shell/agentDispatch.js` (`_listModels` ops carry `params`), and
  `scripts/recipe-test.mjs` (exports `runChecks`). `look` now uses the describe route's 30-min budget.

- 2026-09-16 (session e0fe3905): four items folded in before the harness. (1) The LLM provider
  section becomes SHARED with MPI-737 (coordinator message `b5952029`, Fabio); MPI-774 owns the
  connection store, probe, model list and the Agent row. (2) Fabio's gallery rework: toggle moved,
  drawer replaced by a left panel that pushes the workspace. (3) `agent:*` on the renderer bus for
  the later animation card. (4) Landing box moves beside the headline. The mascot swap is OUT
  (placeholder art until the animation card). Found while reading: `MpiAgentChat` history replay
  reads `role`, the loop writes `kind` - folded into (2).

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
