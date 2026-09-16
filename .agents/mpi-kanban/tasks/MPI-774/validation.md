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
## Phase 3 (2026-09-16, session 7ab56409) — the carried items and the landing rearrange

No GPU used. Batch 1's commit `4cfc489e` is on origin (a peer's `2d4c28d6` went on top of it) and
**master CI is green on `2d4c28d6`**, so the red that blocked the push is gone. The spec the handoff
named was run against this tree first: `npx playwright test --config=playwright.desktop.config.js
tests/desktop/runpod-settings-extract.spec.js --output=<scratchpad>/pw-rp` -> "port 56909 — a dev app
on 3000 is left alone", **1 passed (4.3s)**.

- **3a, trust boundary.** The loop now holds `_images` (attachment ids staged this session + its own
  generations' output paths); `look`/`generate` resolve only through it, and `agentTools
  .resolveImageRef` was deleted (no references left anywhere, grepped). Four new tests in
  `tests/agent-loop.test.cjs` § (e): an invented path (`C:\Users\Fabio\.ssh\id_rsa`) returns
  `IMAGE_NOT_FOUND` and `look` is never called; an attachment resolves to its staged file; a result
  is reachable after the generate settles. **Mutation in the REAL source** (`_resolveImage` falls
  back to `{ path: ref }`) -> 1 fail; restored byte-identical -> `node --test
  tests/agent-loop.test.cjs` 17 pass, 1 skipped (live), 0 fail.
- **3a, found while building it:** attachments were staged TWICE (route + loop), so the chat's ids
  and the model's ids were different files. The route passes staged records in now; the test asserts
  the history entry carries the same id the route returned.
- **3b, attachments placed.** `placeAsset` posts to
  `/project-media/agent/place-preview-asset?folderPath=` with the staged absolute path (the route's
  `dataUrl` accepts one — `copySnapshotSource`), and the returned url becomes `media[].url`; a
  result goes back as `/project-file?path=`. Test asserts both the placeAsset call and that the
  generate body carries the store url, not the scratch path.
- **3c, box bounds dropped.** All three shipped box steps declare `overflow: 'allow'`
  (`flowsRegistry.js:501,511,990`), and the branch read `pixelDimensions` that `resolveAgentMedia`
  never sets. Removed, with the ceiling and upgrade path in a `ponytail:` comment; the test now
  asserts an out-of-bounds box is accepted, so the assertion fails the day the check is rebuilt.
  `node --test tests/connector-agent-tools.test.cjs` -> 14 pass.
- **Landing rearrange (Fabio, 2026-09-16).** The agent slot is a corner panel on the right, lifted
  clear of the crew (`bottom: 160px + 260px × k`: the floor is 160px above the hero bottom at every
  scale, and Video, the tallest character the panel spans, is 260 stage px). The transcript no
  longer claims the panel while empty, so the mascot sits on the box. Verified in a live isolated
  instance (`npm run app:isolated`, port 61176, own profile): `document.elementFromPoint` over a
  6×6 grid on each of the five characters — **0 of 180 points hit the panel**; with the old layout
  restored inline, **66 of 180 did**, across all five. Screenshot in the session log.
- **Wiring run, live, no GPU** (`npm run app:isolated`, own port and profile, `:3000` untouched).
  `POST /agent/probe` -> `{ok: true, tools: true, model: deepseek-ai/DeepSeek-V4-Flash-0731,
  latencyMs: 1305}`. One real turn ("which image models do I have installed, what does the knowledge
  say about the best one for a photoreal portrait, then make me a picture of a fox", `project:
  null`): the captured SSE carried `agent:working` -> `list_models` -> `read_knowledge` (index +
  entries) -> one whole `agent:message`, and `GET /agent/history` shows the same calls in order with
  `usage.promptTokens` 10,120 of a 1,048,576 window. The reply named the installed models, answered
  the portrait question from the corpus, and **asked for a project instead of generating**.
  `app.log` carries the `[connector] Agent job … agent.list-models` lines for both runs.
  **Route re-probe on the same instance** (W1's carried item, never re-run since): `GET
  /connector/models` -> ok with engine, hardware and per-op install state; `GET /connector/knowledge`
  -> ok with entries; `POST /connector/install|describe|generate {}` -> `BAD_REQUEST` naming the
  missing field in each.
- **Two defects the wiring run found, both fixed here:**
  1. **`NO_KEY` inside Electron with the key in the environment.** `_resolveEndpoint` returned early
     on the fork bridge's answer, so the `DEEPINFRA_API_KEY` fallback was unreachable whenever the
     bridge replied at all — the opposite order from `routes/llm.js:57-60` (stored key, then the
     environment). Measured: probe -> `NO_KEY`, and the turn ended in an `agent:error NO_KEY` on the
     stream. Fixed, and the env key is only used when the profile's `baseURL` is still DeepInfra's,
     so an edited profile cannot point the user's key at another host. Three tests in § (f).
  2. **The agent invented project paths.** With no project open it called `open_project` twice with
     guessed folders (`/Users/Shared/Cubric Projects/Fox`, `C:\Users\Public\Cubric Projects\Fox`)
     before giving up. A Project rule was added to the system prompt; the same turn re-run after it:
     `list_models` ×1, `read_knowledge` ×5, **no `open_project`, no `generate`**, and the reply asks
     the user to open or create one.
- **Batch-wide:** `npm test` -> 1097 tests, 1096 pass, 0 fail, exit 0 (1093 before § (e)/(f) were
  added). `npx eslint` on the four edited server / shell files -> exit 0. `npx playwright test ...
  tests/desktop/agent-chat.spec.js` -> **16 passed (44.3s)**. Line endings: every edited file is
  CRLF-consistent and matches HEAD.

- **Carried into Phase 3 (not Batch 1 failures):** `resolveImageRef` trusts any model-supplied path
  (restrict to session attachments + result paths); attachments not placed via
  `place-preview-asset`; box bounds never run on a real submit (no `pixelDimensions`); `/connector/*`
  empty-body probes on an isolated server were reported by W1 from a prior context, not re-run.

## Phase 3, continued (2026-09-16, session e0fe3905) — shared connection, gallery panel, landing

- **Shared LLM connection** (coordinator message `b5952029`; reply `0fb6f49d`). Profiles are
  connection-only, the agent model comes from prefs, `POST /llm/connection/probe` +
  `GET /llm/connection/models` + `RECOMMENDED_REMOTE_MODELS`. `node --test` on
  secrets-endpoint-profiles + agent-loop + llm-service + the new llm-connection -> **35 tests, 34
  pass, 0 fail, 1 skipped (live)**. **Mutations, each RED then restored byte-identical:** chat-tag
  filter dropped; env key sent to any URL; agent pick ignored; attachment kind unchecked; profile
  keeps the model. Live read of DeepInfra `/models` (free GET): 194 entries, tags `chat`/`vision`/
  `image-gen`..., `metadata.context_length`; the parser was written against it.
  Settings in a browser on my instance (`:56182`): connection block on top, Agent row = `Remote`,
  `(recommended) deepseek-ai/DeepSeek-V4-Flash-0731`, mode, Test tool use.
- **Found and fixed:** the old custom-URL group used `group.hidden`, which the form group's
  `display:flex` overrides (never hid) -> `.hide`. Settings controls replaced with `innerHTML` alone
  leaked listeners -> destroyed before re-render, plus a sequence guard on the async model list.
  `look` gave up at 60 s while `/connector/describe` waits 30 min behind a generation -> same budget.
- **Gallery panel** (worker, re-verified here). Toggle between the text field and Enhance; drawer
  gone; shell panel `#agent-panel-mount` pushes `#tool-container`; one SSE stream re-emitted on
  `Events`; history replay reads `kind` (it read `role` and rendered nothing); `GET
  /agent/attachment/:id`. **Worker defects fixed:** `js/events.js` + `js/state.js` flipped to CRLF
  (attr `eol=lf`) -> LF; `initAgentPanel()` never called (outside its ownership) -> wired in
  `js/shell.js`; its specs ran without `--config` so they never ran; its panel test measured a
  fake mount; the old drawer test and every `__fireSse` test could not pass once the stream moved
  to the bus. `npx playwright test --config=playwright.desktop.config.js
  tests/desktop/agent-chat.spec.js` -> **18 passed (52.8s)**. The real-panel test proven: panel
  never opens -> RED; row not a flex row -> RED.
- **Landing box beside the headline** (anchor-positioned to the h1, band bounded by the crew's head
  line). Real bug found: `--crew-k` was set on the crew stage, a sibling of the slot, so the bound
  silently used `--hero-k` -> now set on the hero. And at 1440 wide the column crosses Studio, so
  the bound uses Studio's 360, not Video's 260. Probe (180 points over the five members, per k the
  fit can produce): **0 on the panel** at 1280x720, 1440x900 (k 0.2-0.9, clearance 48-64 px) and
  1920x1032 (k 0.4-1, clearance 54-92 px); headline text ends left of the panel at every size.
- **Suite:** `npm test` -> **1123 tests, 1122 pass, 0 fail, 1 skipped**, exit 0.
  `npm run lint:components` exit 0; `npx eslint` on every touched file exit 0.

### The scripted harness (same session)

- **Command:** `export DEEPINFRA_API_KEY=... && npm run agent:test` (`scripts/agent-test.mjs`,
  `tests/fixtures/agent/` = the real `/connector/models` + `/connector/knowledge` captured from the
  isolated instance, ops given `params`). Real `deepseek-ai/DeepSeek-V4-Flash-0731`, fake tools; the
  fake generate refuses through the app's own `resolveNamedParams`.
- **Result: 9/9 cases pass 3/3** (27 conversations, **$0.0383, $0.00142 each**; price $0.06/M in,
  $0.18/M out, cached input priced as fresh). **`--bite`: 9/9 flips FAIL** as they must ($0.0104).
- **Defects the harness found, all fixed in the loop and pinned by unit tests (each mutation-checked
  RED):** (1) the model never knew the project state: it claimed none was open while one was, and
  called `open_project("")`; every user turn now opens with an app-state line (project by name,
  not path: a shown path got looked at). (2) `/connector/models` never said which named params an op
  takes, so it sent `turbo` to SDXL (the app answers `INVALID_TURBO`); ops now carry `params` =
  `generationControls.namedParamsFor`, proven against `resolveNamedParams` over every shipped
  model/op (`tests/agent-model-params.test.cjs`, mutation RED). (3) no rule for a look refusal or for
  looking first: added. (4) `look` was called with the schema's words "result filePath": the state
  line lists the `_images` allowlist ("Images you can look at: ..."), and the tool text points at it.
  (5) a project opened mid-turn was not used by a later generate in the same turn: adopted.
  First 3x pass (before (4)): 8/9, video-limit 2/3; the pass above is after the fix.
- **Prompt quality:** `npm run agent:test -- --samples research/prompt-samples.md` ($0.0073). Three
  image prompts pass every recipe mechanical check; **both H3 video prompts fail the word budget**
  (44 and 46 of 50-400). Finding and a proposed fix are in the file; Fabio reads it.
- **Suite after all of it:** `npm test` -> 1142 tests, **1141 pass, 0 fail**, 1 skipped;
  `lint:components` exit 0; eslint on every touched file exit 0; `agent-chat.spec.js` **18 passed**.
  `scripts/recipe-test.mjs` now exports `runChecks` and runs its CLI only when invoked (verified from a
  lowercase `c:\ai` cwd too).
