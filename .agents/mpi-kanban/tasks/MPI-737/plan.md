# MPI-737 - Remote LLM providers: per-job model dropdowns, remote image descriptions

Spec: `brief.md`. Contract with MPI-774: `state/messages/0fb6f49d-e050-499e-a9d9-f32989c37ad8.json`
(reply to `b5952029`). Investigation: 2026-09-16, three read-only passes (server, describe path,
settings UI); the maps below are theirs, line numbers as of that day - re-grep before editing.

## Current State

- **Project mode:** scalable-foundation.
- **2026-09-16, where it stands:** planned, not started. D1-D3 decided. MPI-774 accepted the split
  (message `0fb6f49d`) and was told of the decisions, the table-shape drift and two bugs in its
  in-flight storage / Agent-row work (message `4449a649`). **Next action: Phase 0** - wait for MPI-774's
  reply that its connection section is committed, then check HEAD.
- **Card is BLOCKED on MPI-774's connection section** (Phase 0). Three files are shared and must
  be edited in sequence, never in parallel with MPI-774: `js/components/Organisms/MpiLlmSettings/MpiLlmSettings.js`,
  `routes/llm.js`, `services/llmEngines.mjs`.
- **What MPI-774 has in the tree (2026-09-16, partly uncommitted):** `resolveConnection(profileId, ask)`
  (`llmEngines.mjs` ~406), `listRemoteModels({presetId, baseURL, key})` (~363, returns
  `{id, contextWindow, vision, recommendedFor}`), `RECOMMENDED_REMOTE_MODELS` (~343, agent row only),
  `Storage.getLlmConnection()` / `LLM_CONNECTION = 'mpi_llm_connection'` default `{profileId:'deepinfra'}`
  (`js/core/storage.js`, `storageKeys.js`), endpoint profiles + keys in `main/secretsStore.js` (~198-297,
  fork bridge `get-endpoint-profile-request` ~421). **Not there yet:** `/llm/connection/probe`,
  `/llm/connection/models`, connection-only profiles (they still carry `model`/`contextWindow`).
- **Table-shape drift to settle in Phase 0:** the contract says `{preset: {agent:[], enhance:[], describe:[]}}`;
  the code has `{preset: [{id, jobs[], contextWindow}]}`. Build against whatever MPI-774 commits.
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

## Remaining Work

## Phase 0: Gate - MPI-774's connection section is committed

- [ ] Confirm on `HEAD` (not the working tree): `/llm/connection/probe` and `/llm/connection/models`
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

- [ ] **Server: remote enhance + describe.** In `routes/llm.js`: the `endpoint` branch of
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

- [ ] **Renderer: one describe switch point + pref migration.** In `js/services/llmService.js`:
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

- [ ] `MpiLlmSettings.js` (after the batch; MPI-774's connection block sits at the top): Enhancement
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

- [ ] Rewrite `docs/llm.md` (jobs x backends table with Remote, `/llm/describe`, the endpoint branch,
  the "descriptions are ComfyUI-only" rule at ~136 removed), `docs/agent/prompt-enhancement.md` ~59,
  `docs/playbooks/add-flow/ui/prompt-enhance.md` ~186, `docs/agent-chat.md` ~166-182 (only the
  describe-backend lines; MPI-774 owns the rest), stale comments (`MpiPromptBox.js` ~1976,
  `llmService.js` header), a `docs/releases/UNRELEASED.md` bullet. Rule files
  (`component-events-primitives.md` ~216, `component-mounts.md` ~173, `engine-recipes.md` ~14-15)
  **only with Fabio's explicit yes** (CLAUDE.md rule 5) - ask at close-out.
  **Verify:** `rg -n "deepinfra" js/ routes/ docs/` leaves only preset, secrets-slot, price and
  engine-internal hits, each read and justified.

## Plan Drift

- None yet.

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
