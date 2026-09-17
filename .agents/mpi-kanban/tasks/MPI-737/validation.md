# MPI-737 validation

## Phase 0 - gate (2026-09-16, auto) - PASSED

MPI-774 landed its connection section in `b8c293ff` (pushed; message `1343d08b`). Checked on HEAD, not the tree:

- `git grep -n "connection/probe\|connection/models" HEAD -- routes/llm.js` -> `routes/llm.js:186` `router.post('/llm/connection/probe'`, `:198` `router.get('/llm/connection/models'`.
- `js/core/storage.js:314` `getLlmConnection`, `:315` `setLlmConnection`; `storageKeys.js:92` `LLM_CONNECTION: 'mpi_llm_connection'`; default `{ profileId: 'deepinfra' }` (`storage.js:123`).
- `services/llmEngines.mjs:343` `RECOMMENDED_REMOTE_MODELS` in the ARRAY form; `:394` `recommendedModel(presetId, job)`; `:406` `resolveConnection(profileId, ask)`.
- `main/secretsStore.js:192-208` profiles are connection-only (model/contextWindow dropped).
- Claims: MPI-774's `cf605711` / `4a387ed9` are `complete`, its session `closed` (10:54:29Z). No `claimed` record by another session on any batch file; `git status` clean on all of them. MPI-757 holds a live claim on `js/components/types.js` (Phase 3 file only - re-check before Phase 3).

## Parallel batch - server + renderer seams (2026-09-16, auto) - PASSED

Two workers (server: `routes/llm.js`, `services/llmEngines.mjs`, new `tests/llm-describe.test.cjs`; renderer: `js/services/llmService.js`, `js/utils/describeAction.js`, `js/shell/agentDispatch.js` `_describeImage`, `js/services/commandExecutor.js` `runImageDescribe` deletion, `tests/llm-service.test.cjs`), then orchestrator integration fixes (plan.md Plan Drift, "integration fixes"). Re-run independently after integration, not taken from the worker reports:

- `git diff --stat` shows exactly the owned files changed (llm.js, llmEngines.mjs, llmService.js, describeAction.js, agentDispatch.js, commandExecutor.js, llm-service.test.cjs) + new llm-describe.test.cjs.
- `node --test tests/llm-describe.test.cjs` -> tests 20, pass 20, fail 0 (incl. the four integration tests: /project-file URL, relative path refused, recommended-model default, keyless connection sends no Authorization and never borrows DEEPINFRA_API_KEY).
- `node tests/llm-service.test.cjs` -> "All 29 llm service tests passed." (registry-id -> deepInfraId migration through `enhance()`, endpoint error flattened to text, `via` on both describe branches).
- `node --test tests/connector-agent-tools.test.cjs tests/connector-flow-dispatch.test.cjs` -> pass 22, fail 0.
- `npm run lint` -> clean. `npm test` -> tests 1164, pass 1163, fail 0, cancelled 0.
- `rg "imageDescribe" js/` -> the only enqueue is `js/services/llmService.js` (`operation: imageDescribe`).
- LIVE (own `node server.js` on CUBRIC_PORT 7311, DeepInfra key from env, server killed after; no GPU): `/llm/describe` with a `/project-file?path=` URL and NO model -> ok, `model: meta-llama/Llama-4-Scout-17B-16E-Instruct`, text describes the robot mascot; `/llm/enhance` `backend:endpoint` with no model -> ok, `backend: deepinfra`, `model: google/gemma-4-26B-A4B-it`; describe with an absolute path + question -> ok; `/llm/models` carries `deepInfraId`. Server worker earlier: `/llm/connection/models?profileId=deepinfra` lists the describe pick with `vision:true`, `recommendedFor:[describe]`.
- Not yet verified: anything in the app UI (Phase 3, user-ux) and the agent `look` on Remote end to end (Verification step 4).

## Phase 3 - settings rows (2026-09-16, user-ux) - automated checks PASSED, awaiting Fabio

Session `809c7ce1`, claim `f5315739`. Built: Enhancement = Remote / Ollama / ComfyUI, Image descriptions = Remote / ComfyUI,
each Remote row with a model dropdown from ONE `/llm/connection/models` fetch shared with the Agent row (recommended first,
`(recommended) <id>`, describe filtered to `vision`); Account subgroup and the `deepinfra` backend gone; DeepInfra sign-up box
moved under the provider pick (Fabio's ask). Drift fix: Remote enhance model has its own pref `cubric.llm.endpointModel`
(shared key sent a Remote id to Ollama); legacy registry pin mapped only on the deepinfra connection.

- `node tests/llm-service.test.cjs` -> "All 29 llm service tests passed." (migration test extended: Remote pick wins, Ollama keeps its pick, a deepInfraId never reaches openrouter).
- `npx playwright test --config=playwright.desktop.config.js tests/desktop/llm-settings-remote.spec.js tests/desktop/runpod-settings-extract.spec.js --output=<scratchpad>` -> 2 passed (8.0s). New spec: recommended-first order per job, vision filter, prefs written to their own keys, ComfyUI hides the describe model row. RunPod spec: Remote/Ollama/ComfyUI, `endpoint` greyed on a keyless fresh profile, no `#mpiSettingsLlmKeyStatus`.
- `npm test` -> tests 1191, pass 1190, fail 0, skipped 1. `npx eslint` on the three changed JS files -> clean.
- Not yet verified: Fabio's in-app check (plan Verification 1, then 2-5).

### Phase 3 - Fabio's in-app check (2026-09-16) - PASSED, plus three tweaks

- Fabio in his own app (screenshots): both rows on Remote with recommended models first
  (`(recommended) google/gemma-3-12b-it`, `(recommended) meta-llama/Llama-4-Scout-17B-16E-Instruct`,
  agent `(recommended) deepseek-ai/DeepSeek-V4-Flash-0731`), "Test tool use" -> Tools: yes; he ran a Remote image
  description and several Remote enhances ("Enhanced by google/gemma-3-12b-it for MiniMax H3 Reference").
  "Everything seems to be working fine." Covers Verification 1 and the enhance half of 3; step 2's "no describe job
  in the Cue while a generation runs" was not stated explicitly.
- His three asks, built after the check: DeepInfra sign-up box moved to the TOP of Remote connection; API key group
  hidden when the provider is Ollama (keyless, `routes/llm.js` exempts it); Agent backend is a fixed boxed label
  `Remote · <provider>` (`#mpiSettingsAgentBackend`, `.mpi-settings__fixed-value`), no dropdown.
- Re-verified: both desktop specs -> 2 passed (new assertions: fixed agent label, key group hidden on Ollama);
  `npm test` -> 1191 tests, 1190 pass, 0 fail; eslint clean. Fabio has NOT yet looked at the three tweaks.
- 2026-09-16 (session `5da6c574`): Fabio looked at the three tweaks in his app - "they're all good. They all pass."

## Phase 4 - docs + orphans (2026-09-16, auto) - PASSED

Session `5da6c574`, claim `d27875c1`. Fabio chose option A (retire the whole DeepInfra-only chain) and said yes to the
three rule files.

- Retired: `priceLabel` + its test, the `/llm/models` price fetch (`fetchDeepInfraPrices` kept: `scripts/agent-test.mjs`
  uses it), `GET /llm/status` (0 callers in Vision, Studio, Prompt), `defaultBackend()`, the `deepinfra` branch of
  `/llm/enhance` (it now REQUIRES `endpoint|ollama`), the route's `deepInfraKey()`/`hasDeepInfraKey()`, the fork-bridge
  `secrets:{get,has}-deepinfra-key-request` handlers, `secretsClient.{set,has,clear}DeepInfraKey` and their three IPC
  channels. The main-process `deepInfraApiKey` slot and its functions stay (the `deepinfra` profile reads them).
- Bug folded in: `enhanceFlow` sent the Ollama registry pick (mapped via deepInfraId) to Remote, ignoring
  `cubric.llm.endpointModel`; `enhance()` and `enhanceFlow()` now share `_endpointEnhanceModel(profileId)`. New
  `testFlowEnhanceSendsTheRemotePick` FAILED against the old line ("a Flow must send the Remote pick"), passes on the fix.
- `node tests/llm-service.test.cjs` -> "All 29 llm service tests passed." (priceLabel test out, flow test in; the IPC
  test asserts no `deepinfra` channel and no key `get` channel; the fork-bridge test asserts the retired request gets
  no answer and the deepinfra profile request returns the slot's key).
- `node --test tests/llm-describe.test.cjs tests/llm-connection.test.cjs` -> pass 27, fail 0, incl. the new case:
  `backend:'deepinfra'` and no backend are both refused with "'endpoint' or 'ollama'".
  `node tests/secrets-endpoint-profiles.test.cjs` -> 8/8.
- `npx eslint` on the 7 changed JS files -> clean. `npm test` -> tests 1192, pass 1191, fail 0, skipped 1.
- `rg -n -i deepinfra js/ routes/ docs/`: what remains is presets / `DEFAULT_LLM_CONNECTION`, slot comments, the
  `deepInfraId` legacy mapping, `DeepInfraEngine` (engine internal), the sign-up box, and copy naming DeepInfra as a
  provider. Left alone: `docs/proprietary-models-research/00-cubric-vision-integration-points.md:78` (dated research).
- Docs: `docs/llm.md` rewritten (172 lines); `docs/agent/prompt-enhancement.md`, `docs/playbooks/add-flow/ui/prompt-enhance.md`,
  `docs/agent-chat.md` (describe lines), `docs/README.md` router row; the `UNRELEASED.md` Language Models bullet rewritten
  (it never shipped). Rule files, with Fabio's yes: `engine-recipes.md`, `component-events-primitives.md`, `component-mounts.md`.
- Desktop specs not re-run: no settings code changed, and the removed `secretsClient` methods and `priceLabel` have no importer.
- Still open: Verification 2 (describe not in the Cue during a generation), 4 (agent `look` on Remote),
  5 (keyless Remote fails plainly).

### End-to-end checks - Fabio's screenshots (2026-09-16 ~13:40Z)

- **Step 4, Remote half: PASSED.** The agent's "Describe this image." with an attached picture shows
  "LOOKING AT IMAGE" and a full description, in a project panel ("1.4 media", "GIF Tests") and on the
  landing chat.
- **Step 4, ComfyUI half: PASSED (Fabio, 2026-09-17 ~09:50Z).** Descriptions on ComfyUI, agent panel in
  "1.4 media", "Describe this image." with the retriever/turtle attached: "LOOKING AT IMAGE" then a full
  description. His engine log shows the route taken: `[connector] Agent job f51d4a89-...: agent.describe`
  at 09:49:28Z, then comfy `got prompt` and `Generating tokens .../512`.
- **Step 5, settings half: PASSED.** With the key cleared ("No API key saved."), Prompt enhancement stays
  on Remote with "Remote is not set up: the connection above needs a provider and an API key. Finish it,
  or pick another backend." and the model dropdown reads "Connect first". Not shown yet: a describe or
  enhance actually attempted in that state failing with the D1 message.
- **Step 5, the attempt (Fabio, 2026-09-17 ~10:00Z): no fallback PASSED, the message form FAILS D1.**
  Key cleared, both on Remote. Nothing ran on ComfyUI. But (a) right-click Describe opened the
  "Image Description Failed" ERROR MODAL (Show log file / Report on GitHub) with "No API key saved for
  this connection. Check Settings > Remote > Language Models.", not a toast: `describeAction.js` emits
  `ui:error` (`shell.js` -> `showError`) although its own header and D1 say toast (`ui:warning` ->
  status-bar notice); (b) the Enhance dialog note reads only "No API key saved for this connection."
  with no way to Remote > Language Models: `runServerBackend` passes the route message through bare.
- **Fix (session 53d9d605, Fabio's go):** `llmService.withRemoteSettingsHint(code, msg)` (skips
  BAD_REQUEST / BAD_IMAGE / no code) now shapes both: `runServerBackend`'s endpoint error (every enhance
  caller) and `describeAction`, which emits `ui:warning` instead of `ui:error`. `tests/llm-service.test.cjs`
  asserts the Enhance text carries the pointer and BAD_REQUEST stays bare: 29/29; with the hint removed
  from `runServerBackend` it FAILS (`testEnhanceEndpointErrorIsText`), restored green. `npm test`
  1267 pass / 0 fail / 1 skipped (the shared working tree, so peers' uncommitted tests are in that
  count); eslint clean on the three files. Claim auditor at close-out: no FALSE findings. `docs/toasts.md` rows, `docs/llm.md`.
- **Step 5 re-run: PASSED (Fabio, 2026-09-17 ~10:25Z, after a reload).** Keyless, both on Remote: right-click
  Describe shows a "HEADS UP" status-bar notice, "No API key saved for this connection. Check Settings >
  Remote > Language Models.", no modal ("GIF Tests"); the Enhance dialog note reads the same two sentences.
  **All five end-to-end steps have now passed.**
- **Step 2: PASSED (Fabio, 2026-09-17 ~09:50Z).** Descriptions on Remote, right-click Describe during a
  running local generation: "text landed while generating". His screenshot ("1.4 media"): the golden
  retriever/turtle description in the prompt box while the status bar reads "LOADING MODEL · 0% · 0:37"
  on MiniMax H3.
