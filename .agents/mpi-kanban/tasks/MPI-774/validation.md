# MPI-774 Validation

Evidence per plan item, newest at the bottom. Card closes when every brief item 1-15 has a line
here, the harness passes 9 cases 3/3, and Fabio's pass is recorded.

## Phase 0

- **Contract, `docs/agent-chat.md`** (2026-09-15): written, 180 lines (`wc -l`). Brief items 1-15
  each have a row in § "Brief items -> surface" (15 of 15, plus profiles/probe). The six brief
  § Architecture tools (list models, read knowledge, install, generate, look, open project) each
  have a parameter schema in § Tools. `docs/README.md` routes it (Core app table, after Flows).
  `validate_board.py .` -> "Board validation passed."
- **Describer question** (2026-09-15, Fabio authorised the agent to edit `raw/`): node 38 retitled
  `Text String (System Prompt)` -> `Input_Describe_Prompt` in `comfy_workflows/raw/image_descriptor.json`
  (one line; node 46 carries the same old title and is unconnected, left alone).
  `node scripts/sync-raw-workflows.mjs` -> raw committed `aff97551`, converted, "All 1 file(s)
  conform to the injection rules", runtime staged. Scripted check against a pre-sync snapshot of
  runtime node 38: title `Input_Describe_Prompt`, `value` identical (1773 chars), feeds
  `36.prompt`, title unique -> PASS. `node --test tests/inject-params-titles.test.cjs` -> 23 pass,
  0 fail. `git diff --cached comfy_workflows/image_descriptor.json` -> the `_meta.title` line only.
  No GPU used (the sync reads `/object_info` only).

## Parallel Batch 1 (2026-09-15, session 5be4be69, four background workers)

Every worker report was re-verified by the orchestrator on disk; reported "mutation guards" inside
the test files were simulations, so each gate was broken in the REAL source, run, and restored
byte-identical. No GPU used by any step.

- **Pre-dispatch:** MPI-766 `done` + claim `766c1a1e` `complete` -> W4 got the landing slot. MPI-677
  in `doing` with no live session -> message `b59959d0` names the shared paths.
  `Storage.getAgentPrefs/setAgentPrefs` added (`js/core/storage.js`, `STORAGE_KEYS.AGENT_PREFS`):
  node smoke with a localStorage shim -> default `{deepinfra, auto}`, round trip `{openrouter, ask}`,
  bogus mode normalises to `auto` -> "agentPrefs OK".
- **W3 (profiles, keys, Agent row):** `node --test tests/secrets-endpoint-profiles.test.cjs` -> "All 8
  endpoint-profile tests passed"; `tests/llm-service.test.cjs` -> 18 pass. Six IPC channels
  (`list/save/delete-endpoint-profile`, `set/has/clear-endpoint-key`), no get. Mutation: fork-bridge
  URL binding `keyData && keyData.boundURL === profile.baseURL` -> `keyData` -> exit 1; restored
  byte-identical -> 8/8.
- **W2 (loop):** `node --test tests/agent-loop.test.cjs` (no key) -> 14 tests, 13 pass, 1 skipped
  (live). Worker's live DeepInfra run: `list_models` called, `prompt_tokens` 1,351 (1,024 cached),
  `reasoning_tokens` 0, 7,139 ms. `llm-service` + `ollama-lifecycle` (every `llmEngines` consumer)
  -> 13 pass. Mutation: install gate replaced with an immediate `installModel` -> 11 pass / 2 fail;
  restored -> 13 pass.
- **W1 (connector):** `node --test tests/connector-agent-tools.test.cjs` -> 14 pass. Mutations in
  `validateBoxParams`: UNKNOWN_PARAM -> 1 fail, integers -> 1 fail, square -> 2 fail, bounds ->
  **0 fail** (test asserted only the in-bounds case); test fixed to assert the rejection and the
  `overflow: 'allow'` pass -> bounds mutation 1 fail; restored -> 14 pass. Manifest now lists only
  `generation.submit`; confirmed correct: nothing serves `system.memory.release` since MPI-677 step 2
  (`3b8052d6` removed the responder), so `docs/releases/portable-distribution-contract.md`
  § Connector Manifest was rewritten to match.
- **W4 (chat):** `npx playwright test --config=playwright.desktop.config.js
  tests/desktop/agent-chat.spec.js --output=<scratchpad>/pw-out` -> "[desktop suite] port 63771 — a
  dev app on 3000 is left alone", **9 passed (27.9s)** (standalone landing chat only; prompt-box
  toggle cases sent back to W4). W4 added 7 cases (prompt-box toggle, Enter sends one POST,
  Shift+Enter sends nothing, Prompt mode posts no `/agent/message`, `agent:result` card +
  compacting line, mascot `src` flips back, `mode`/`profileId` from `Storage.getAgentPrefs()` in the
  body). Orchestrator re-run: "[desktop suite] port 62156 — a dev app on 3000 is left alone",
  **16 passed (47.3s)**. CR count 0 on all eleven W4 files. `npm run lint:components` -> exit 0.
- **Integrator fixes:** CRLF churn reverted to LF in six files the workers wrote (`secretsStore.js`,
  `secretsClient.js`, `connector.js`, `build-portable.mjs`, `MpiPromptBox.js/.css`; HEAD is LF and
  `git diff --stat` hides it); unused `eslint-disable` removed; raw `es.addEventListener` in
  `agentService.js` -> `on()`; W4's `index.html` slot div (outside its ownership) accepted.
- **Batch-wide:** `npm test` -> tests 1074, pass 1073, fail 0, exit 0. `npm run lint` (`eslint js/
  --max-warnings=0`) -> exit 0. `npx eslint` on the server files (`routes/connector.js`,
  `routes/agent.js`, `services/agentLoop.mjs`, `services/agentTools.mjs`, `main/secretsStore.js`,
  `scripts/build-portable.mjs`) -> exit 0.
- **Carried into Phase 3 (not Batch 1 failures):** `resolveImageRef` trusts any model-supplied path
  (restrict to session attachments + result paths); attachments not placed via
  `place-preview-asset`; box bounds never run on a real submit (no `pixelDimensions`); `/connector/*`
  empty-body probes on an isolated server were reported by W1 from a prior context, not re-run.
