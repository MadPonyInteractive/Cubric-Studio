# MPI-737 - Remote LLM providers: per-job model dropdowns, remote image descriptions

Spec: `brief.md`. Contract with MPI-774: `state/messages/0fb6f49d-e050-499e-a9d9-f32989c37ad8.json`
(reply to `b5952029`). Investigation: 2026-09-16, three read-only passes (server, describe path,
settings UI); the maps below are theirs, line numbers as of that day - re-grep before editing.

## Current State

- **Project mode:** scalable-foundation.
- **2026-09-17 ~10:15Z (session 53d9d605), where it stands:** end-to-end steps 1-4 PASSED (Fabio). Step 5:
  no ComfyUI fallback PASSED, but the describe failure opened the error modal and Enhance lacked the
  settings pointer; fixed UNCOMMITTED (`withRemoteSettingsHint` in `llmService.js`, `ui:warning` in
  `describeAction.js`, test + two docs; `validation.md` § step 5). **Next:** Fabio reloads and re-runs
  step 5 (keyless Describe -> status-bar notice with the pointer; Enhance dialog note with the pointer),
  then `mpi-end-session`, which also takes his Remote-describe progress ask (below). His agent-box UI
  feedback went to a new card, MPI-797 (todo, blocked on MPI-774's claim).
- **2026-09-16 ~13:25Z, where it stood:** Phases 0-4 DONE. Phase 3 + its three tweaks verified by Fabio in his app;
  Phase 4 (docs, rule files with his yes, orphan chain option A, `enhanceFlow` model fix) auto-verified
  (`validation.md`). **Next action:** the rest of the end-to-end checks with Fabio. His screenshots already
  passed step 4's Remote half and step 5's settings half. Still open: step 2 (a Remote describe during a
  local generation lands in the prompt box, no Cue job), step 4's ComfyUI half, and step 5's attempt (a
  describe/enhance on keyless Remote fails with the D1 message). Then `mpi-end-session` (brief's four
  points one by one). The same session also took MPI-774 feedback (that card's plan, Phase 3c).
- **Open ask from Fabio (2026-09-16), NOT built:** a Remote describe shows no progress (a ComfyUI describe shows in
  the status bar). He expects to use one of the mascot animations "that we will implement soon". Needs his call at
  close-out: fold into this card, or a new card once the mascot animations exist.
- **`/llm/enhance` now REQUIRES `backend: 'endpoint'|'ollama'`** - no server default, no `deepinfra` branch. An
  external caller relying on the old default gets an error naming the two values.
- **Phase 3 shape (for Phase 4 docs):** one `/llm/connection/models` fetch per render (`_refreshModels`) feeds the
  Enhancement, Image descriptions and Agent model dropdowns via `_remoteModelOptions(job, saved, filter)`; Remote is
  greyed only on NO_KEY / NO_PROFILE (`_remoteBlocked`), an unreachable endpoint stays pickable with the error in the
  model note; describe list = `vision` models (+ the describe recommendation), whole list with a note when the
  endpoint reports no `vision` flags.
- **Renderer API Phase 3 builds on** (all exported from `js/services/llmService.js`):
  `describeBackendPreference()` / `setDescribeBackendPreference('comfy'|'endpoint')` (key
  `cubric.llm.describeBackend`, default `comfy`); `describeModelPreference()` / `setDescribeModelPreference(id)`
  (key `cubric.llm.describeModel`, raw endpoint id; empty = the server uses `recommendedModel(profileId,'describe')`);
  `backendPreference()` / `setBackendPreference('comfy'|'endpoint'|'ollama')` (stored `'deepinfra'` is
  migrated to `'endpoint'` and persisted on read); `enhancerModelPreference()` / `setEnhancerModelPreference(id)`
  (a registry id maps to `deepInfraId` via `/llm/models`; a raw id passes through; empty = server uses
  `recommendedModel(profileId,'enhance')`). `describeImage({imagePath, question, crop, scope, group})` ->
  `{ ok, via:'comfy'|'endpoint', text?, errorCode?, error?, cancelled? }`, never rejects.
- **Picks (live-checked 2026-09-16):** deepinfra describe = `meta-llama/Llama-4-Scout-17B-16E-Instruct`
  (not abliterated - Phase 3 copy must say a hosted model may refuse adult images); enhance =
  `google/gemma-4-26B-A4B-it`, `google/gemma-3-12b-it` (the registry's deepInfraIds). DeepInfra vision
  models ARE tagged `chat`, so `listRemoteModels`' filter keeps them; 107 models listed.
- MPI-774's connection section is committed and its claims are `complete`; the three shared files are
  ours to edit now. MPI-774's next session (Phase 3b) may touch `services/agentCorpus.mjs` and the agent
  system prompt only - re-check claims before Phase 3 anyway.
- **What MPI-774 had in the tree (2026-09-16, before it committed; the HEAD shape is under Plan Drift):** `resolveConnection(profileId, ask)`
  (`llmEngines.mjs` ~406), `listRemoteModels({presetId, baseURL, key})` (~363, returns
  `{id, contextWindow, vision, recommendedFor}`), `RECOMMENDED_REMOTE_MODELS` (~343, agent row only),
  `Storage.getLlmConnection()` / `LLM_CONNECTION = 'mpi_llm_connection'` default `{profileId:'deepinfra'}`
  (`js/core/storage.js`, `storageKeys.js`), endpoint profiles + keys in `main/secretsStore.js` (~198-297,
  fork bridge `get-endpoint-profile-request` ~421). **Not there yet:** `/llm/connection/probe`,
  `/llm/connection/models`, connection-only profiles (they still carry `model`/`contextWindow`).
- **Table shape:** settled in Phase 0 - the array form (Plan Drift).
- **Key migration is already zero-copy:** the `deepinfra` profile reads the old `deepInfraApiKey` slot
  (`secretsStore.js` ~261-297, ~432). What remains is UI removal and pref migration.
- **Today's enhance:** `llmService.js` prefs `cubric.llm.backend` (default `comfy`, values
  `comfy|deepinfra|ollama`, `chooseBackend` ~140) and `cubric.llm.enhancerModel` (a MODEL_REGISTRY id);
  `runServerBackend` (~462) posts `{prompt, system, backend, modelId, maxTokens}` to `/llm/enhance`
  (`routes/llm.js` ~261; accepts only `deepinfra|ollama` at ~270, maps registry id at ~272-278, engine at ~300).
- **Today's describe is ComfyUI-only and rides the generation queue.** Right-click ->
  `js/utils/describeAction.js` -> `enqueueGeneration('imageDescribe')` -> `_cueQueue`, one job per lane
  (`generationService.js` ~374-379), so a describe waits behind a generation and blocks the next one;
  on a Pod it runs on the Pod. Text lands in the prompt box (`workspace:inject-prompts`). The agent's
  `look` -> `POST /connector/describe` (`routes/connector.js` ~641) -> relay `agent.describe` ->
  `agentDispatch._describeImage` (~538-577), a second copy of the same enqueue with the question
  ChatML-wrapped into `Input_Describe_Prompt` (node 38). `commandExecutor.runImageDescribe`
  (~1184-1244) is dead code. `look` times out at 60 s (`agentTools.mjs` ~87) while a queued describe
  can wait longer.
- **The switch must live in the renderer:** backend prefs and plugin status are renderer-only.
- **Engine honesty:** `DeepInfraEngine(apiKey, baseUrl)` (`llmEngines.mjs` ~422) takes any
  OpenAI-compatible URL but hardcodes `backend = 'deepinfra'` and "DeepInfra chat failed". It passes
  `messages` through unchanged, so image content parts should reach the endpoint - **untested**.
- **Name collision:** "remote" already means the RunPod GPU lane in code (`generationStore.js` ~73,
  `remoteEngineClient.js` ~95, `commandExecutor.js` ~1435). See Decision D2.

## Decisions (all decided 2026-09-16; MPI-774 told by message 2026-09-16)

- **D1 - Describe or Enhance on Remote when it cannot run** (no connection, no key, endpoint error,
  model rejects images). **DECIDED (Fabio 2026-09-16):** say so plainly (toast naming the reason + a way
  into Remote > Language Models); **never fall back to ComfyUI on its own** - MPI-728's rule, nothing
  switches silently. For the agent's `look`, the error text goes back to the agent, which suggests
  switching (MPI-774 brief item 8).
- **D2 - Internal backend value.** **DECIDED (Fabio 2026-09-16):** code value `'endpoint'`, UI label
  **"Remote"**. `'remote'` in code would collide with the RunPod lane, where ComfyUI describe already
  runs. Stored `'deepinfra'` migrates to `'endpoint'`.
- **D3 - Managed Ollama.** **DECIDED (Fabio 2026-09-16):** keep **Ollama (local)** as its own backend
  beside Remote - it owns install/start/pull (`MpiOllamaSetup`) and releases VRAM after every call
  (`OllamaEngine.releaseOwnModels`), which a bare `/v1` connection does not. The connection section's
  ollama preset stays for users who want it through Remote.
- **Settled defaults (no question needed):** the describe model dropdown lists only models the endpoint
  flags `vision` where it reports modalities, and all models with a "may not accept images" note where it
  does not; recommended ids are exact per preset (MPI-774's rule), custom/ollama get no hints; describe
  text keeps landing in the prompt box; the Remote describe is **not** queued, so it never waits behind a
  generation; the `box` answer stays MPI-774's (its route drops it today, `connector.js` ~642).

## Completed

- [x] Spec (`brief.md`), ownership split agreed with MPI-774 by message, investigation. 2026-09-16.
- [x] Phase 0 gate (HEAD `b8c293ff`). 2026-09-16.
- [x] Phase 3: settings rows - Remote on Enhancement + Image descriptions with model dropdowns, Account block gone,
  Remote enhance model on its own pref; Fabio verified in the app, then three tweaks (also verified). 2026-09-16.
- [x] Phase 4: docs + rule files + orphan chain + `enhanceFlow` model fix (Plan Drift). 2026-09-16.
- [x] Parallel batch: `/llm/describe`, endpoint enhance, honest engine label, recommended rows;
  `describeImage` switch point, pref migration, dead `runImageDescribe` deleted; integration fixes
  (Plan Drift). 2026-09-16.

## Remaining Work

## Phase 0: Gate - MPI-774's connection section is committed

- [x] Confirm on `HEAD` (not the working tree): `/llm/connection/probe` and `/llm/connection/models`
  exist in `routes/llm.js`; profiles are connection-only; `Storage.getLlmConnection()` is committed;
  the final `RECOMMENDED_REMOTE_MODELS` shape. Read MPI-774's `plan.md` Current State and any reply on
  message `0fb6f49d`. Re-read `state/index.json` claims on the three shared files; if MPI-774 still
  holds one, message it and wait. Record the shape found under Plan Drift.
  **Verify:** `git grep -n "connection/probe\|connection/models" HEAD -- routes/llm.js` returns both;
  no fresh claim by another session on the three shared files. Then move the card
  `todo -> doing` with `files.json` (CLAUDE.md kanban rule).

## Parallel Batch: server and renderer seams (after Phase 0)

The route contract below is fixed here so both halves can be built at once and verified with fakes.

**Contract - `POST /llm/describe`** body `{ profileId, modelId, imagePath, question?, crop? }` ->
`{ ok:true, text, backend, model }` | `{ ok:false, error:{ code, message } }`, codes
`NO_PROFILE | NO_KEY | ENDPOINT_ERROR | NOT_VISION | BAD_IMAGE`.
**Contract - `POST /llm/enhance`** additionally accepts `backend:'endpoint'` + `profileId` + a raw
endpoint `modelId` (no MODEL_REGISTRY lookup on that branch); `comfy`/`ollama` unchanged.

- [x] **Server: remote enhance + describe.** In `routes/llm.js`: the `endpoint` branch of
  `/llm/enhance` building its engine from `resolveConnection(profileId, ask)`; the new `/llm/describe`
  (resolve connection -> read the image from disk -> `crop` if given -> `sharp` downscale to <= 1 MP in
  16-px steps, matching `image_descriptor.json` node 41 so `mapFromDescribeSpace` stays valid -> JPEG
  base64 `image_url` part -> `chat`). The default instruction is read at runtime from
  `image_descriptor.json` node 38 (`Input_Describe_Prompt`), never copied; a `question` replaces it as
  plain text (no ChatML - that wrapping is ComfyUI-only). A 4xx naming image input -> `NOT_VISION`,
  never a silent retry without the image. In `services/llmEngines.mjs`: the engine reports an honest
  `backend` (the profile's preset id / name) instead of hardcoded `'deepinfra'`, errors name the
  profile; fill the `enhance` rows (DeepInfra: from `MODEL_REGISTRY` `deepInfraId`) and `describe` rows
  (DeepInfra vision model chosen by one live call per candidate against MPI-774 brief § Describer
  criteria). Retire `defaultBackend()` and the DeepInfra-shaped `/llm/status` fields only if no caller
  remains (grep first). Ownership: `routes/llm.js` (the `/llm/enhance` and `/llm/describe` handlers and
  their helpers only), `services/llmEngines.mjs` (engine label + the enhance/describe rows only),
  `tests/llm-describe.test.cjs` (new), `tests/llm-service.test.cjs` (server assertions only).
  Briefings: `behaviour`, `dos_and_donts`, engine-recipes briefing (paste from `.claude/rules/engine-recipes.md`).
  **Verify:** `node --test tests/llm-describe.test.cjs tests/llm-service.test.cjs` green with a fake
  fetch asserting the `image_url` part, the <= 1 MP size and each error code; then ONE live call on your
  OWN server (`npm run app:isolated` or `npm run server` on a private port, never `:3000`) with the
  DeepInfra profile: `/llm/describe` on a real project image returns text naming its subject, and
  `/llm/enhance` with `backend:'endpoint'` returns `backend` naming the profile, not `'deepinfra'`
  hardcoded.

- [x] **Renderer: one describe switch point + pref migration.** In `js/services/llmService.js`:
  `chooseBackend` accepts `endpoint`; `backendPreference()` maps a stored `'deepinfra'` to `'endpoint'`
  and `enhancerModelPreference()` maps a stored MODEL_REGISTRY id to its `deepInfraId` for the endpoint
  branch; per-job endpoint model prefs (`cubric.llm.enhancerModel` keeps its key, new
  `cubric.llm.describeBackend` default `comfy`, `cubric.llm.describeModel`); `runServerBackend` sends
  `profileId` from `Storage.getLlmConnection()` on the endpoint branch; new
  `describeImage({ imagePath, question, crop, scope, group })` - `comfy`: plugin check +
  `enqueueGeneration('imageDescribe')` (moved, with the ChatML question wrapping, out of both callers);
  `endpoint`: `POST /llm/describe`, no queue. D1 governs every failure. `js/utils/describeAction.js` and
  `js/shell/agentDispatch.js` `_describeImage` both call it; delete dead
  `commandExecutor.runImageDescribe` (~1184-1244). Ownership: `js/services/llmService.js`,
  `js/utils/describeAction.js`, `js/shell/agentDispatch.js` (`_describeImage` only - MPI-774/776 edit
  this file; claim-check at dispatch, anchor by content), `js/services/commandExecutor.js`
  (`runImageDescribe` deletion only), `tests/llm-service.test.cjs` (renderer assertions only - coordinate
  with the server task: split by `describe(` block, or run this task second).
  Briefings: `frontend-worker` bundle, `state`, `events`, `component-events-lifecycle`.
  **Verify:** `node --test tests/llm-service.test.cjs` covers the two migrations and both
  `describeImage` branches with a stubbed `fetch`/`enqueueGeneration`; `rg -n "imageDescribe" js/`
  shows `enqueueGeneration('imageDescribe'` in `llmService.js` only; `npm test` green.

`mpi-execute-parallel` fits this batch only if the two tasks split `tests/llm-service.test.cjs`
cleanly; otherwise run server first, renderer second.

## Phase 3: Settings rows (user-ux)

- [x] (Fabio verified 2026-09-16) `MpiLlmSettings.js` (after the batch; MPI-774's connection block sits at the top): Enhancement
  backends ComfyUI / Ollama / **Remote** (`endpoint`; disabled with a note when the shared connection has
  no key - `secretsClient.hasEndpointKey(profileId)`); when Remote, the model dropdown fills from
  `GET /llm/connection/models?profileId=` via `el.setOptions`, `recommendedFor` containing `enhance`
  first, label `(recommended) <id>`, `meta` = context window when known (not the `icon:'sparkle'` idiom -
  it eats the meta slot). Image descriptions row: ComfyUI / **Remote**, its own model dropdown
  (`describe` recommendations, vision filter per the settled default), persisted to the new prefs;
  copy says **where the work runs** (Remote: no local VRAM, never waits behind a generation; ComfyUI:
  local or on the Pod, uncensored), never a quality ranking, and that a hosted model may refuse adult
  images. Remove the DeepInfra account/key subgroup (~88-106, ~221-293) and the `deepinfra` entry in
  `BACKENDS` (~72-76); keep `.mpi-settings__signup` CSS (RunPod uses it). Every re-render of our rows
  destroys the instances it replaces (the Agent row's sub-renders leak today - MPI-774's code, report
  it, do not fix it here). Update `tests/desktop/runpod-settings-extract.spec.js` (~74, ~85-86) and add a
  spec asserting recommended-first ordering against a stubbed `/llm/connection/models` (stub
  `window.fetch` in-page; memory `tool_electron_ui_check_fixture_fetch`).
  Ownership: `MpiLlmSettings.js` (+ `.css`), `js/components/types.js` (`MpiLlmSettingsProps` ~970-979),
  the two desktop specs. Briefings: `frontend-worker`, `component-events-primitives`, `component-mounts`.
  **Verify:** `npm test` and the two desktop specs green (`--output=<scratchpad>`, memory
  `tool_desktop_specs_private_output_dir`); then **Fabio in the app** - see Verification.

## Phase 4: Docs and stale copy

- [x] (2026-09-16, auto) Rewrite `docs/llm.md` (jobs x backends table with Remote, `/llm/describe`, the endpoint branch,
  the "descriptions are ComfyUI-only" rule at ~136 removed), `docs/agent/prompt-enhancement.md` ~59,
  `docs/playbooks/add-flow/ui/prompt-enhance.md` ~186, `docs/agent-chat.md` ~166-182 (only the
  describe-backend lines; MPI-774 owns the rest), stale comments (`MpiPromptBox.js` ~1976,
  `llmService.js` header), a `docs/releases/UNRELEASED.md` bullet. Rule files
  (`component-events-primitives.md` ~216, `component-mounts.md` ~173, `engine-recipes.md` ~14-15)
  **only with Fabio's explicit yes** (CLAUDE.md rule 5) - ask at close-out.
  **Verify:** `rg -n "deepinfra" js/ routes/ docs/` leaves only preset, secrets-slot, price and
  engine-internal hits, each read and justified.

## Plan Drift

- **2026-09-16 - Phase 4: wider than the doc pass.** (1) Fabio chose option A: with 0 callers found (Vision, Studio,
  Prompt), `/llm/status`, `defaultBackend()`, the `deepinfra` branch of `/llm/enhance`, the route's key helpers and
  the two `secrets:{get,has}-deepinfra-key-request` bridge handlers went along with the listed orphans; the route now
  requires `endpoint|ollama`. (2) Bug: `enhanceFlow` still sent the Ollama pick to Remote (Phase 3 fixed only
  `enhance()`); one helper `_endpointEnhanceModel(profileId)` now serves both. (3) The unshipped MPI-728
  `UNRELEASED.md` bullet said "DeepInfra", so it was rewritten instead of adding a second one. (4) Stale comments in
  `routes/forkBridge.js`, `routes/remoteEngine.js` and the `docs/README.md` router row were fixed too (claim extended).
- **2026-09-16 - Phase 3: Remote enhance model got its OWN pref.** `cubric.llm.enhancerModel` held Ollama's registry id
  AND would have held the Remote raw id, so a Remote pick reached Ollama as an unknown id while the Ollama dropdown
  showed the default. New `endpointModelPreference()` / `setEndpointModelPreference()` (key `cubric.llm.endpointModel`);
  `enhance()` reads it on the endpoint branch, else maps the legacy registry pin via `deepInfraId` ONLY when the
  connection is `deepinfra` (a deepInfraId means nothing on another provider). Orphaned by Phase 3, retire in Phase 4:
  `priceLabel` (+ its test) and the `/llm/models` price fetch, `secretsClient.setDeepInfraKey/hasDeepInfraKey/clearDeepInfraKey`
  and their `secrets:*-deepinfra-key` IPC channels (the deepinfra PROFILE still reads that slot in main - keep the slot).

- **2026-09-16 - Phase 0: the shape MPI-774 committed (`b8c293ff`), build against THIS:**
  - `RECOMMENDED_REMOTE_MODELS` (`llmEngines.mjs:343`) = `{ [presetId]: [{ id, jobs: ('agent'|'enhance'|'describe')[], contextWindow? }] }`
    - the ARRAY form; the object form in message `0fb6f49d` is superseded. `deepinfra` carries one
    agent entry; `openrouter`/`openai` are empty; `custom`/`ollama` absent. Helper
    `recommendedModel(presetId, job)` -> first id or `''` (`:394`). Adding an enhance/describe row =
    push `{ id, jobs: ['enhance'] }` (or add the job to an existing entry's `jobs`).
  - `listRemoteModels({presetId, baseURL, key})` (`:363`) -> `[{ id, contextWindow: number|null,
    vision: boolean|null, recommendedFor: string[] }]`, recommended first. **A tagged catalogue
    (DeepInfra) is cut to entries tagged `chat`** - if DeepInfra's vision models are not also tagged
    `chat`, the describe dropdown comes up empty; the server task checks this live and widens the
    filter to keep `vision`/`vlm` if needed.
  - `resolveConnection(profileId, ask)` (`:406`) -> `{ profile: {id,name,baseURL}|null, key|null }`;
    stored key, then `DEEPINFRA_API_KEY` for the deepinfra preset only while its URL is DeepInfra's.
    The one server-side resolver - `/llm/describe` and the endpoint enhance branch use it.
  - Routes (`routes/llm.js:186`, `:198`): `POST /llm/connection/probe {profileId}` ->
    `{ok, latencyMs, modelCount}`; `GET /llm/connection/models?profileId=` -> `{ok, profileId, models}`;
    errors `BAD_REQUEST | NO_PROFILE | NO_KEY (ollama exempt) | ENDPOINT_ERROR + status` via
    `_connectionError` / `_connectionModels` - reuse them for `/llm/describe`'s profile errors.
  - `Storage.getLlmConnection()` -> `{ profileId }` (default `'deepinfra'`), `setLlmConnection`;
    `Storage.getAgentPrefs()` -> `{ model, mode }`.
  - Settings: connection block (`#mpiSettingsConnProfileSlot`, `...ConnUrl...`, `...ConnKey...`,
    `...ConnProbe...`) sits above the Account block; Agent row = `#mpiSettingsAgentBackendSlot`
    (dropdown value `'remote'`, label Remote) + `#mpiSettingsAgentModelSlot`. MPI-774 invites renaming
    that row-local value to `'endpoint'` when Phase 3 touches it.
  - `agentTools.look` no longer times out at 60 s (uses the route's 30 min budget); `agentDispatch._listModels`
    changed in `b8c293ff`, `_describeImage` did not.
- **2026-09-16 - batch test split (resolves "split `tests/llm-service.test.cjs` cleanly"):** the server
  task writes ALL its assertions (describe + endpoint enhance + engine label) in the new
  `tests/llm-describe.test.cjs` and does not edit `tests/llm-service.test.cjs`; the renderer task owns
  `tests/llm-service.test.cjs` whole. The server task must keep `DeepInfraEngine(apiKey, baseUrl)`
  call-compatible (`llm-service.test.cjs:183-197` constructs it), so both run in parallel.
- **2026-09-16 - integration fixes (orchestrator, after both workers reported):**
  - **Seam bug:** the right-click path sends an item's `filePath`, which is a `/project-file?path=` URL,
    but `/llm/describe` only accepted a disk path, so every Remote right-click describe would have been
    BAD_IMAGE (neither worker could see it: one tested a real path, the other a stubbed fetch). The route
    now decodes the URL and refuses a relative path. ponytail note in the route: the same decode lives
    un-exported in `routes/projects.js`, `gif.js`, `gifMake.js`.
  - **Key boundary:** `DeepInfraEngine.resolveKey` fell back to `DEEPINFRA_API_KEY` for ANY base URL, so a
    keyless connection (Ollama `/v1`) either threw "API key missing" or sent the DeepInfra key to another
    host. Now only a DeepInfra URL (or none) borrows the env key; a keyless connection sends no
    `Authorization`. Fixed in the engine, so MPI-774's `agentLoop.mjs` call sites get it too.
  - No model picked -> both endpoint routes use `recommendedModel(profileId, job)` instead of BAD_REQUEST.
  - `/llm/enhance`'s endpoint `{code,message}` error is flattened to text in `runServerBackend` (every
    enhance caller renders `error` as a string); `GET /llm/models` now carries `deepInfraId` (renderer
    message `c818c65e`, resolved).
  - `describeImage` results carry `via`; the right-click toast points at Remote settings only for an
    endpoint failure, keeps the Model Library warning for DESCRIBER_MISSING, and stays silent for a
    ComfyUI run failure (the generation pipeline reports it) - as before the batch. The agent keeps
    `CANCELLED` for a cancelled ComfyUI describe.
  - Removed `/llm/describe`'s hardcoded fallback instruction (a copy of node 38): a node 38 that stops
    parsing now fails with RUNTIME_ERROR. Static import of `describeImage` in `agentDispatch.js`, orphaned
    `pluginAvailability` import dropped. The renderer worker's "migration" test never exercised the
    migration; replaced with one that goes through `enhance()`.
  - Kept as built: describe only DOWNSCALES (node 41 also upscales small images); harmless because
    `mapFromDescribeSpace` takes the actual input size.

## Verification

**Verify mode:** user-ux (Phase 3 and the end-to-end check); Phase 0, the batch and Phase 4 are `auto`.

End to end, on Fabio's app with the DeepInfra profile connected:
1. Enhancement and Image descriptions both show **Remote**, no "DeepInfra" backend, no DeepInfra-only
   key field; the model dropdowns list recommended models first with "(recommended)".
2. Start a local generation, then right-click Describe with descriptions on Remote: the text lands in
   the prompt box while the generation is still running, and no describe job appears in the Cue.
3. Enhance on Remote names the connected provider/model in the dialog.
4. The agent's `look` answers from the Remote describer when that is the pick, and from ComfyUI when it
   is not.
5. With the connection's key cleared: Remote shows disabled with a note, and a describe/enhance already
   set to Remote fails with the D1 message - nothing runs on ComfyUI instead.

## Preservation Notes

- `docs/llm.md` is the subsystem doc to rewrite (Phase 4). Rule-file edits need Fabio's yes.
- Report to MPI-774 (not ours): committed `MpiLlmSettings.js` Agent row and `js/services/agentService.js`
  (~36) still read `prefs.profileId`, which its uncommitted `storage.js` drops -> `NO_PROFILE`
  (`tests/desktop/agent-chat.spec.js` ~521-542 asserts the old shape); Agent row sub-renders leak
  instances (`innerHTML` clears at ~564, ~610, ~666); `look`'s 60 s timeout vs a queued ComfyUI describe.
- The "what the user said got lost" lesson: MPI-677 closed with this spec undelivered. Close-out should
  check the brief's four points one by one.
