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

## Phase 3b (2026-09-16, session 105b3570) — Fabio's round

Fabio's answers: deletion is barred for the IN-APP agent only (outside agents keep the delete
routes); model skill packs = option (a), our own guide per shipped model; project memory is built
in this card.

- **1. Never deletes.** `node --test tests/agent-no-delete.test.cjs` -> 4/4: no delete-shaped tool
  offered, an invented `delete_card` / `delete_project` / `remove_media` is `UNKNOWN_TOOL`, the
  prompt carries "Deletion rule: You never delete anything", and every request `agentTools.mjs`
  can make is on an allowlist (12 entries). Bite (`bite_nodelete.py`, bytes restored): a
  `delete_card` tool def, a `delete_card` executor case, the rule text dropped, a
  `deleteProject` -> `/delete-project` export, and an innocently named unlisted route each turn
  it RED. Harness case `no-delete`: no tool call, the reply says only the user deletes and where.
- **3. Panel.** `#agent-panel-mount` margin-top 52px (was padding) and 420px. Measured on an
  isolated instance (`:53030`, scratch project, playwright-cli 1600x900): before, the panel
  started at y 32 behind the topbar row; after, topbar 32-84, panel from y 84, 420 wide, the
  workspace from x 420, and the back link still takes its own clicks. `agent-chat.spec.js -g
  "agent panel"` passes with `panelWidth === 420` and `panelTop >= topbarBottom`; reverting to
  320 (`Received: 320`) or to padding (`Received: 32`) turns it RED (`bite_panel.py`).
  Screenshots before/after in the session scratchpad. **Fabio's eyes still owed** (user-ux).
- **4. Rules.** component-maps worker (Sonnet), HEAD-only reads: `component-mounts.md`,
  `component-events-primitives.md`, `component-events-blocks.md`, `component-state.md`,
  +39/-2; I re-checked `git diff --stat` (only those four) and LF on each. It found
  `gallery:open-card` had no listener: a chat result card opened nothing. Fixed in the shell
  (`agentPanel.js` opens the card's Group History when the open project holds it and it is not
  audio; declared in `js/events.js`); spec `a result card opens its card history...` passes
  (recorded navigate: only the in-project image card), and the map line was corrected.
  Left for Fabio: where the agent's `Input_Describe_Prompt` injection belongs in the rules.
- **5. Project memory.** `node --test tests/agent-memory.test.cjs` -> 9/9 (store on real temp
  projects: create, in-place update keeping user lines, one-line titles, slug-only file names
  incl. `../`, `a\b`, `README.md`, NOT_A_PROJECT, NOTE_TOO_LONG, MEMORY_FULL with updates still
  allowed; routes: round trip, 400 vs 200 envelope, no DELETE route). Loop block (h) in
  `agent-loop.test.cjs` (9 tests): the open project's folder only, NO_PROJECT without one,
  the notes index on the first turn per project and after a switch, "Noted: <title>" label.
  Live on `:50257`: note written, listed, read back; `../project.json` -> 400.
- **2. Skills and guides.** Corpus gains `guide` (9 files, `docs/agent/models/<recipeId>.md`,
  H3 by me, eight by four Sonnet workers, each reviewed by me: fixed SDXL's labelled
  POSITIVE/NEGATIVE blocks (the agent fills `prompt` and `negative`), Klein `t2i` media,
  Illustrious `inpaint` ratios, mask-op and mature-content wording) and `skill` (the six
  `cubric-vision*` files with an in-app preamble; `copyAgentSkills` stages them for the
  portable build). `node tests/agent-corpus.test.cjs` -> 10/10, including every shipped model
  resolving to an existing guide (it was RED while guides were missing), guide shape (heading,
  30-200 lines, brief footer, no placeholder, no em dash), every skill file served whole, and
  the build copy landing where the corpus looks. `/connector/models` adds `guides` and per-op
  `media` roles gated by `filterMediaInputsForModel` (`connector-agent-tools.test.cjs`: H3 t2v
  has no audio slot, LTX has one, ref2va slots carry `Picture N` tags). Live on `:50257`:
  guides and gated media per model, knowledge kinds model 16 / guide 3 (then) / skill 6 / app 4,
  guide text with its footer, skill text with its preamble. Loop: GUIDE_NOT_READ gate,
  `rename_card` (own cards only) and `cardName`, finished generations queued for the next turn.
- **Bite for 2 and 5** (`bite_phase3b.py`, bytes restored, suites green after): slug check off,
  project check off, no note cap, update-appends, route 400 -> 200, guide gate off, a settle
  pushing into the context mid-turn, rename of any card, a model-named notes folder, and the
  notes index repeated every turn: all 10 RED.
- **Lint:** eslint on every touched file exit 0 (one app-lifetime listener carries the repo's
  disable comment); `npm run lint:components` exit 0.
- **Harness, Phase 3b** (`npm run agent:test`, deepseek-ai/DeepSeek-V4-Flash-0731, real model, fake
  tools, live corpus): **13/13 cases pass 3/3** (the nine Phase 3 cases plus reads-guide-first,
  memory-read, memory-write, no-delete), $0.0696 for 39 conversations ($0.00178 each; the guide
  read and the bigger model list roughly doubled input tokens). `--bite`: **13/13 bite** (each
  flip fails its check), $0.0287. Full node suite `npm test` -> 1191 tests, 1190 pass, 0 fail, 1
  skipped. `agent-chat.spec.js` (private `--output`) -> **19 passed**.
- **Prompt samples** (`--samples research/prompt-samples.md`, $0.0152): all five pass every recipe
  check. The H3 prompts, the measured baseline (44 and 46 words, no shot marker, no sound), are now
  150 and 190 words with a look line, `[Shot 1]`, a camera line, both sound fields and a
  rendering-only constraint line. First run caught the agent pasting the H3 guide's worked example
  verbatim, because that example WAS a sample request (SDXL's too): both guide examples were
  replaced with requests the samples do not use, and the rerun shows a written adaptation.

## Phase 3b item 3 - Fabio (2026-09-16, recorded by MPI-737 session 5da6c574)

- Fabio screenshots: the panel sits BELOW the "<- PROJECTS" row; `look` answered on Remote in a project and on the landing page. His note: the transcript text touches the panel edge.
- Fixed: `MpiAgentChat.css` `#agent-panel-mount .mpi-agent-chat__transcript { padding-inline: var(--s-3) }` (the header gutter). `npx playwright test --config=playwright.desktop.config.js tests/desktop/agent-chat.spec.js --output=<scratchpad>` -> 19 passed. Awaiting his reload to close item 3.
- **Closed** 2026-09-16 ~14:30Z (session 6fd51047): Fabio answered "1" (looks good) after the padding commit `3dd0301a`. Phase 3b is complete: items 1-5 each have evidence above.
- Phase 4 location, Fabio: option A (an isolated instance attached to the engine his app runs, GPU lease held, his app untouched; the install test on a throwaway store on K:).

## Phase 3c (2026-09-17, session 6fd51047) — one conversation per project, landing project jobs

Fabio: "go" to "go, all recommended", so D4-D6 as recommended. No GPU, no app instance (a peer's
uncommitted server edits were in the tree when this started; see plan Current State).

- **Server, unit** `node --test tests/agent-sessions.test.cjs` -> **15/15**: separate histories for two
  projects and the landing page, one key however a folder is written, D4 busy across conversations, D5
  move (landing starts fresh, `agent:session`, events before/after the move carry the right key), D5
  carry (the project keeps its own, the request and its attachment go over, the landing gives the file
  up), a project conversation carries and never moves, reset clears one conversation and discards only
  its files, an install card answered in its own conversation, `open_project` refusing an invented
  folder before the app is asked and taking listed / created / typed ones, the landing Project rule in
  the prompt, `discardAttachments` never touching a file outside the attachment dir, and the two real
  routes over a throwaway `APP_DOCUMENTS` (a second "Fox Shoot" gets its own folder and the first
  `project.json` is byte-identical; the list returns both folders and only name/folder/date; a
  nameless or 101-char create is a 400 and makes nothing; no DELETE route).
- **Bite, server** (`bite_sessions.py`, 13 mutations in the real source, bytes restored and
  hash-checked, `git diff --stat` unchanged): busy ignoring running loops, never moving, carry keeping
  the attachment, the carried request never running, events without `session`, reset wiping every
  conversation's files, `open_project` taking any folder, a typed folder refused, keys keeping
  backslashes, discard leaving the attachment dir, the project list leaking whole projects, a 101-char
  name accepted, no D5 hook: **13/13 RED**; restored source green.
- **No-delete allowlist** grew by exactly `GET /connector/projects` and `POST /connector/create-project`
  (it went RED on the new route before that edit, as designed); `discardAttachments` is a local helper.
- **Renderer, desktop** `npx playwright test --config=playwright.desktop.config.js
  tests/desktop/agent-chat.spec.js --output=<scratchpad>/pw-3c` -> "port 56054 — a dev app on 3000 is
  left alone", **24 passed (1.4m)**: the 19 earlier cases (stubs now answer in the real shape, every
  event with `session`) plus a chat rendering only its own conversation's events, the panel swapping
  conversations with the project and getting Alpha's back, the landing chat keeping the landing
  conversation (sends `project: null`) while a project is loaded, both chats reloading on
  `agent:session`, and a BUSY reply showing its message and ending "working".
- **Bite, renderer** (`bite_renderer.py`, the five new cases, bytes restored): no session filter, no
  reload on `project:changed`, the landing chat sending the loaded project, no reload on a move, BUSY
  ignored, history ignoring the project: **6/6 RED**; restored 5 passed.
- **Found and fixed in the chat:** a 200 reply with `ok: false` (BUSY, NO_PROFILE) left it "working"
  for good, and a failed generation rendered `[object Object]` (both the live event and the history
  replay passed the error object as the message). Confirm-card buttons are destroyed when the
  transcript is cleared. The body carries `project: { folderPath, name }` only, no longer the whole
  project with its cards.
- **Suite:** `npm test` -> **1265 tests, 1264 pass, 0 fail**, 1 skipped. `npm run lint` and
  `npm run lint:components` exit 0; `npx eslint` on every touched server, test and script file exit 0.
  `node tests/agent-corpus.test.cjs` -> 10/10 after the H3 guide edit.
- **Harness, first pass** (`npm run agent:test`, prompt as first written): 14 of 15 cases 3/3,
  **`ask-first` 2/3**: in Ask first the model generated at once and called medium "the Auto default".
  Source: the H3 guide said "`medium` is the Auto default" and "Turbo on" as bare facts, and the mode
  rule never said to stop and wait. Both reworded (the guide names the mode; the rule says end the reply
  and generate only after the answer, a guide's recommendation is not permission). A separate 6x run
  before the fix was 6/6, so the rate was about 1 in 9. $0.0960 for 45 conversations. Also found on a
  1x smoke: the model named a make-something project after the request and wrote a brief note; the
  Project rule now says exactly "New Project" and no note -> `create-then-generate` 3/3.
- **Harness bite, final prompt** (`npm run agent:test -- --bite`, loaded after both rewordings):
  **15/15 bite** (each flip fails its check: `open-by-name` without Harbour Nights in the list,
  `create-then-generate` with a project already open, `new-project-brief` asked for a picture instead,
  `memory-write` against a full note store, and the eleven earlier flips), $0.0375.
- **Harness 3x, final prompt** (`npm run agent:test`, same code as the bite): **14 of 15 cases 3/3**,
  `ask-first` 3/3 after the fix. **`new-project-brief` 2/3 - NOT closed:** run 1 created "Lighthouse
  Keeper and the Seal", opened it and wrote the brief note correctly, then generated a first shot with
  H3 nobody asked for (the check's "generated without being asked"). $0.0980 for 45 conversations
  ($0.00218 each). Log: session scratchpad `harness-final-3x.log` (expires).
