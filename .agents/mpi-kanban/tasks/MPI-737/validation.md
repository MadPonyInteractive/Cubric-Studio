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
