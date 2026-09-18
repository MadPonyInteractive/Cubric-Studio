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

### Phase 3c close (2026-09-17, session d56a1cbe)

- **`new-project-brief` fixed:** the Project rule's goal branch now ends "ask what they want to make
  first. Do not generate anything in that turn". `--case new-project-brief --runs 3` -> **3/3**, then
  `--runs 6` -> **6/6** ($0.0057). Full `npm run agent:test` (3x, new prompt) -> 14/15, **`install-asks`
  2/3**: run 3 called `install_model("ltx-2.3")`, a guessed id, and got a Yes card for a model that does
  not exist (the card fell back to the raw id and a null size). Bite pass (new prompt) **15/15**.
- **Fabio's landing-page check (full restart), verbatim in intent: "Everything worked nicely."**
  Fox from the landing box -> "New Project", generated there; the lighthouse goal -> named project, brief
  note, asked what to make first, nothing generated; switching projects keeps each chat; open by name
  works. "Open new project." made a second New Project, which he called fine. His screenshots showed
  three defects, all fixed here:
  1. **Broken result image in the chat.** Cause: the renderer item's `filePath` is already
     `/project-file?path=...` (`generationService.js:1224`), and `_appendResult` wrapped it again, so the
     route got a url as a path (404). The spec stubbed an absolute path, so it never saw the real shape.
     Fix: the existing `resolveMediaUrl` (`js/utils/mediaActions.js`).
  2. **List numbers invisible.** The shared `.mpi-md li::marker` is `--ink-4`, as light as the panel's
     `--surface-1`. Fix: `--ink-2` for markers inside a chat message.
  3. **A carried request confused its new conversation** (screenshot: "You mentioned 'From GIF Tests:
     Open new project.' ... New Project is already open") and **showed no bubble live** (only after a
     reload that happened to run after it). Fix: a carried turn opens with a handover line (the project
     is already open for it; do only what is left), and emits `agent:user` so the chat draws the bubble,
     once by entry id.
- **Also fixed: `install_model` on an unknown id** returns `UNKNOWN_MODEL` before any card (and a failed
  model-list read returns `RUNTIME_ERROR` instead of a card with no size).
- **Unit:** `tests/agent-sessions.test.cjs` 15/15 (the D5 carry test now checks `agent:user` session, id,
  text, attachments, and the handover line in the target only); `tests/agent-loop.test.cjs` 38 pass, 0 fail,
  1 skipped (+ unknown id -> no card). **Bite** (`bite_units.py`, bytes restored and hash-checked): no
  unknown-id refusal, no handover line, no `agent:user`, carried flag dropped, handover on every turn:
  **5/5 RED**.
- **Desktop:** new case "a result in the real shape loads; a carried request draws once; list markers
  show" (a real `/project-file` url must load, `naturalWidth > 0`; a history `u1` plus a live `u1` and
  `u2` = two bubbles, the second with its `/agent/attachment/` thumb; marker colour = `--ink-2`) ->
  passed. **Bite** (`bite_chat.py`): url wrapped again, `agent:user` unsubscribed, no dedup, marker
  colour removed: **4/4 RED**.
- **Harness after the install fix:** `--case install-asks --runs 6` -> **6/6** ($0.0110); bite for
  `install-asks`, `install-needed`, `picks-installed-model` -> **3/3 bite**.
- **Suite:** `npm test` -> **1269 tests, 1268 pass, 0 fail**, 1 skipped; `npm run lint` and
  `npm run lint:components` exit 0; `tests/desktop/agent-chat.spec.js` (private `--output`) -> **25 passed
  (1.4m)**. Touched files keep HEAD's LF endings.
### Phase 3d - the agent box (MPI-797), built 2026-09-17, session d56a1cbe - waits on Fabio's eyes

- **Desktop, new case** "PromptBox Agent mode: own text and hint, only the toggle, no run, numbered
  chips" (Wan 2.2 `i2v_ms`): a typed prompt, then Agent mode -> the field is empty with the hint; only
  `#textarea-slot` and `#mode-toggle-slot` show and the text takes > 80% of the bar; the staged
  start-frame chip turns into a bare "1"; two more images stay (three on an op that takes two),
  numbered 1-3, no pill; Ctrl+Enter emits no `run` and sends exactly one `/agent/message`; the chips
  clear; three more, back to Prompt mode -> "my prompt" is back, the hint is gone, two chips with
  "Start frame" / "Last frame". **Updated case** "agent panel: the real shell mount ...": open = 420 wide,
  bottom = the status bar's top, prompt box and controls start at the panel's right edge; a drag to
  -60 px -> 360 and stored "360"; a drag far left -> 280 (clamp) and stored "280"; closed -> the prompt
  box is back where it was. Both pass.
- **Bite** (`bite_3d.py`, 15 mutations in the real source, bytes restored and hash-checked): agent text
  sharing the prompt, no hint, slots not hidden, grid not collapsed, the op cap in Agent mode, the frame
  pill in Agent mode, the slot badge rule in Agent mode, no repaint on toggle, no fit on leaving, the run
  hotkey generating, panel not full height, prompt box not offset, drag ignored, width not stored, no
  clamp: **15/15 RED**.
- **Found on the way:** Ctrl+Enter never reached the textarea (the hotkey manager takes it in the capture
  phase), so in Agent mode it used to start a GENERATION from the prompt; it now sends the message.
  Sending an agent message used to wipe the saved positive prompt (`_writeMode('')` on the shared field).
  A box mounted with Agent mode already on never got the agent-mode class.
- **Suite:** `npm test` -> **1273 tests, 1272 pass, 0 fail**, 1 skipped; `npm run lint` and
  `npm run lint:components` exit 0. The layout-touching specs (`agent-chat`, the five `flow-*` that
  reference the shell mounts, `gif-make`, `history-modes`; private `--output`) -> **40 passed (4.0m)**.
- **Coordination:** `js/shell/preloadStyles.js` was claimed by MPI-772 (claim `b772a1c0`); asked
  (message `550b11f3`), it released the file and asked for its two GIF panel lines as well (`a550e772`).
  All three lines are in; `node --test tests/flow-result-dock.test.cjs tests/mask-tool-registry.test.cjs`
  (the two tests that read the file) -> 50 pass, 0 fail.

- **Fabio, in his app (2026-09-17): "Okay, it passed."** (screenshots: agent box with the hint, full-height
  panel, a two-reference Klein edit through the agent, a carried "From 1.4 media:" request drawn in
  GIF Tests' chat). Item 5 waits for the mascot animations; no gallery entry for `MpiResizeHandle`.

### Phase 3d items 6-7 (2026-09-17, session d56a1cbe)

- **Item 7, the edit card's shape.** Ground truth, read-only, in his project (`Projects/test`, "GIF
  Tests"): `edit_056.png` is **832x1248** (PIL); its sidecar `b7e9112f-...json` says `operation: kleinEdit`,
  `pixelDimensions {w:1024,h:1024}`, `injectionParams Width 1024 / Height 1024 / Ratio_Label 1:1`. Klein
  lists `kleinEdit` in `imageSizedOps`, so the PromptBox hides the ratio and sends none; the agent path's
  `resolveNamedParams` still injected the project's saved ratio, and `/project/save-generation` trusts a
  client Width/Height over the file. Fix: skip the ratio there (`modelShowsRatio`). New test in
  `tests/agent-model-params.test.cjs`, over every shipped model and op with a project saved at 1:1: an
  image-sized op injects no Width/Height/Ratio_Label, a ratio op still does -> 4 pass; **fix removed ->
  1 fail**; restored -> the four agent/connector param suites **54 pass, 0 fail**. His existing
  `edit_056` card still carries the wrong size (not touched).
- **Item 6, the head toggle.** `MpiButton` `image` prop; the prompt-box case now also checks the toggle's
  `<img>` is `assets/mascot/logo.png`, loads, is `grayscale(1)` while off and unfiltered while on ->
  passed. **Bite** (`bite_head.py`): chat icon kept, image not muted, image never full colour: **3/3 RED**.
  Found on the way: the two `MpiButton` files had turned CRLF in the working tree (HEAD LF); normalised
  to LF, diff = our lines only.
- **Skill** `.claude/skills/cubric-vision-generate/SKILL.md`: image-sized ops take no ratio and get no
  project ratio; the success `filePath` is a `/project-file?path=` url (it said a plain path).
- **Suite:** `npm test` -> **1275 tests, 1274 pass, 0 fail**, 1 skipped; `npm run lint` exit 0;
  `node --test tests/agent-corpus.test.cjs` after the skill edit -> pass; `agent-chat.spec.js` +
  `flow-toggle-is-a-button.spec.js` (private `--output`) -> **27 passed (1.7m)**.

- **Rule map** (Fabio "yes to maps"): `.claude/rules/component-events-primitives.md` MpiAgentChat block
  gains `agent:user`, `agent:session`, `project:changed`, the session filter, and `_reload()`.

### Phase 3d item 6, second pass (2026-09-17, session 047d6088) - the Studio head, Enhance-sized

- **Fabio:** wrong head (the Vision camera, `assets/mascot/logo.png`) and too small (the `sm` 16px icon
  size). Now `assets/mascot/studio/logo.webp`: `Studio-Logo.png` (2000x2000) trimmed of its transparent
  margin and fitted to 128px wide (sharp) -> **128x86, 3.4 KB**; opened, it is the robot face.
  `MpiButton` adds `mpi-ibtn--image` when it draws an image; at `sm` the button drops its padding and the
  image is 32px tall, so the button is as tall as the Enhance button beside it.
- **Spec** (`PromptBox Agent mode: own text and hint ...`): src is the webp; the toggle and the Enhance
  button differ by <= 1px in height; the head is at least the Enhance height minus 4 -> **passed**.
  **Bite** (class renamed so the rule never applies): **RED**, `Expected: >= 30, Received: 16`; restored.
  Screenshots of the box off and on (scratchpad, not kept): the head sits between the text and the
  Enhance button at its height; in Agent mode it is in full colour at the right edge.
- **Suite:** `eslint` on the three touched JS files -> clean; `agent-chat.spec.js` (private `--output`)
  -> **26 passed (1.6m)**. `docs/agent-chat.md` and `.claude/rules/component-mounts.md` name the new src.

## Phase 4 (2026-09-17, session 047d6088) - live on the GPU, option A

- **Where:** my own `npm run app:isolated` (own profile in the session scratchpad, ports 53508 -> 64037 ->
  64802 across restarts), `CUBRIC_MODELS_ROOT=G:/CubricModels`, attached to the engine on 48188; `:3000`
  untouched. Pre-checks: GPU free, 48188 queue empty, `git status -- routes/ server.js services/ main/`
  clean, no dep/pin commit newer than the user's app start. Every dispatching command ran under
  `gpu_lease.py run`. Scratch project "MPI-774 agent test" in his Projects root (his to delete).
- **The person images, through the agent** (turn 1, Auto): "three separate photoreal images of people"
  -> `list_models`, `read_knowledge guide:sdxl`, three `generate` (SDXL Realistic t2i, 3:4 / 4:5 / 1:1),
  one whole reply, **3 results in 193 s**, then a `look` after each result and no unrequested
  regeneration (`/agent/history`). All three opened: a red-haired woman full body in a park, a bearded
  older man at a cafe table, a young man in a hoodie on a night street. Nit: the reply said "Here's what
  was generated" while the three were still queued.
- **Box measurement:** `research/box-measurement.md` (raw answers, both describers, three images, two
  phrasings). Verdict: both answer RELATIVE (Qwen3-VL 0-1000, Llama-4-Scout 0-1); drawn on the originals,
  only that reading lands on the head in all three. The json phrasing gave a clean `bbox_2d` 6/6.
- **Defect 1, found live: a ComfyUI describe with a question never showed the model the image.** The first
  ComfyUI box call produced no HTTP answer for 300 s; `app.log`: `imageDescribe returned no text` 2 s in.
  `buildDescribeInjectionParams` sent `system {question} ... <|im_start|>user`, no `<|image_pad|>`, no
  assistant header, and a `<|im_start|>` prompt skips the tokenizer template (`qwen3vl.py`). Now the whole
  turn in the baked default's shape. Unit test pins it and checks the baked node 38 still has that frame:
  pass; **old stub back -> 1 fail**; restored. Live after: six ComfyUI box answers in 5.8-10.5 s.
- **Defect 2: an empty caption hung every text-op caller** (`generationService` warned, called nothing):
  describe, ComfyUI enhance, both agent-dispatch paths, a Flow's auto-Enhance before Generate. Now
  `onError`. **Live:** a bait question ("Output nothing at all") -> `RUNTIME_ERROR "The model returned no
  text."` in **3.5 s** (the same empty answer hung >300 s before). No unit seam (the module imports DOM
  components); the live run is the check.
- **Box parser** in `POST /connector/describe` (`box: true` + `question`; `boxFromDescribeAnswer`,
  `NO_BOX`). `tests/connector-agent-tools.test.cjs` replays the six json answers (box holds the face, stays
  in the head region) plus wrappers, crop and refusals: 16/16. **Bites, 4/4 RED:** read as pixels (3 fail),
  crop ignored (1), key digits kept (2), inverted box accepted (1); restored. **Live:** `box` without a
  question -> `BAD_REQUEST`; "the man's head" on 002 -> `{362,70,303,429}`, drawn and opened: on the head;
  a 350 px crop on 001 -> a box inside the crop, but around the whole visible person, not the head (the
  model, on a tight crop; the whole-image answer was right).
- **Suite:** `npm test` 1276 / 1275 pass / 0 fail / 1 skipped; `eslint` on the seven touched files exit 0.
- **Head Swap through the agent, first try: GUESSED boxes** (turn 2, the two photos attached, "put the
  young man's head from picture 2 onto the older man in picture 1"). Two descriptive `look`s, then
  `generate head-swap` with `box1` and `box2` both `{0,0,512,512}` and an INSTRUCTION in the `positive`
  field. Opened `flowHeadSwap_001.png`: half a swap, grey hair and beard left on a younger face (the
  guessed box cut the head at x 512). Causes: no rule said to measure, nothing refused a guess, and
  `list_models` listed the field as a bare `"positive"` (it is Head Swap's EXPRESSION field).
  **Fixes:** (1) a **box gate** in the loop, like the guide gate: a Flow `params` box answers
  `BOX_NOT_MEASURED` until a `look` with `box: true` measured the image passed for that box's role;
  a compaction clears it. `tests/agent-loop.test.cjs`: box on the other image / look without box /
  measured -> refused, refused, started; 39/39. **Bites 4/4 RED** (look never records, no gate, any
  measured image opens it, compaction keeps boxes); restored. (2) A Box rule in the system prompt. (3)
  The describe route returns `square` (same centre, longer side) for `ratio: 1` steps. (4) The flow
  catalog lists `fields: [{id, label}]`, step fields included (`flowDeclaredFields`).
- **Head Swap, second try (turn 3, same request, fresh instance):** two descriptive looks, then
  `look box: true` on each ("the older man's head (face, hair and jaw included)") -> `box` + `square`,
  then `generate head-swap` with `box1 {299,70,429,429}` and `box2 {302,92,479,479}` = the two squares,
  `positive: "a calm, neutral expression"`. The rule did it; the gate never had to fire. Opened
  `flowHeadSwap_002.png`: the young man's head on the older man's body, cafe, jacket and cup unchanged,
  no leftover beard or grey hair.
- **Edit with a reference, first try: WRONG SOURCE** (turn 4, same conversation, `t2i_003` + `t2i_001`
  attached, "Edit picture 1: give the young man the long red hair of the woman in picture 2"). It
  looked at both attachments, read `guide:krea-2` and `guide:flux-2`, then ran `klein-9b kleinEdit`
  with `inputImage` = the PREVIOUS turn's Head Swap result and `inputImage2` = the woman, and its
  reply said so ("the current state of picture 1 we've been editing"). Opened `edit_001.png`: the
  cafe man with long red hair and freckles, so the reference worked, on the wrong image. Cause: the
  box numbers its chips 1, 2, 3 but the model got `[Attached image: t2i_003.png (id: ...)]`, no
  number, while turn 3 had its own "picture 1". **Fix:** `[Attached image N: ...]` in chip order plus a
  Numbering rule (a message's "picture 2" is that message's attachment 2, never an earlier image).
  `tests/agent-loop.test.cjs` 40/40; **bites 2/2 RED** (unnumbered line, rule removed); restored.
- **Edit with a reference, second try** (fresh instance; turn 5a "Who is in picture 1?" with `t2i_002`
  attached gives "picture 1" a meaning, then 5b the same edit request with `t2i_003` + `t2i_001`): it
  looked at both, read `guide:krea-2`, ran `krea2 krea2Edit` with `inputImage` = this message's
  attachment 1 and `inputImage2` = attachment 2, and said so. Opened `edit_002.png`: the neon-street
  young man with the woman's long red hair, hoodie, face and street unchanged, 1:1 like its source.

### ComfyUI enhance VRAM (folded MPI-677 step 1d), 2026-09-17, session 047d6088

- **Method.** The exact graphs the app dispatched, read back from ComfyUI `/history`: a Klein 9B t2i
  (the connector's generate route, 1:1) and the prompt box's ComfyUI Enhance for Klein 9B
  (`llmService.enhance` run in a page on MY instance, closed right after, since the relay feeds the
  newest window). Replayed on 48188 under the lease with fresh seeds every run (`vram_seq.mjs`),
  polling `/system_stats` every 0.5 s and reading the engine's load lines from the app log. No other
  client ran a prompt during the sequences (history before/after: 11 new, all mine). RTX 4060 Ti 16 GB,
  ComfyUI 0.34.
- **As shipped** (gen, enh, gen, enh, gen, gen): gen 12.9 / 11.3 / 11.1 s; enhance 12.2 / 11.9 s
  (loads `Krea2TEModel_`, the 4B, 5.0 GB staged; min free VRAM 10.2 GB); the gen repeated with the
  same prompt 9.6 s (52 cached nodes). **Free VRAM is back to 15.1 GB after EVERY run, generation or
  enhance**: nothing stays resident between prompts (dynamic VRAM staging, and both graphs end in
  `MpiClearVram`); every generation logs `Requested to load Flux2TEModel_` / `Flux2` again.
- **Control, no enhance:** two DIFFERENT prompts alternated, 10.0 / 10.1 / 11.4 / 9.9 s (36 cached).
  So the gen after an enhance (11.1-11.3 s) costs what any changed prompt costs. **Verdict: the
  enhancer does not make the next generation cold**; there is no resident model for it to evict.
  MPI-35 phase 2's claim is moot on this engine. Certain regardless, by design: a ComfyUI enhance is a
  queued job.
- **Found on the way: the Klein encoder borrow (Fabio, 2026-09-13) never reached ComfyUI**, and
  neither did `Replace Text.replace` (MPI-35's newline override). The dispatched graph still said
  `qwen3vl_4b_abliterated` / `krea2` and `replace: ""` while the enhance result reported
  `model: qwen_3_8b_int8_convrot` (read from the params, not the graph). Cause: commandExecutor's
  `Input_` canonicalization renamed every bare key, dotted ones too, so `Load CLIP.clip_name` went to a
  title `Input_Load CLIP` no graph has, and the injector skips unknown titles silently. Fix: the pass
  moved to `js/utils/injectionKeys.js` and keeps a dotted key's bare form (the alias still lands
  `Video_Latent.*`). `tests/injection-keys.test.cjs` 3/3; `tests/llm-service.test.cjs` now checks each
  enhance key LANDS on the graph after the pass (it checked them before the pass, which is how this
  hid): 29/29. **Bite** (old pass): 1 fail in each. **Live:** the same page enhance after the fix ->
  graph `qwen_3_8b_int8_convrot` / `flux2`, `replace: "\n"`; 15.8 s.
- **The borrow, measured** (enh, gen, enh, gen, gen with the corrected graph): enhance 16.6 / 15.9 s
  (the 8B, 9.0 GB staged, min free VRAM 5.5 GB), its loader output cached from the generation; the
  gen after it 9.7 / 10.4 s (loader cached). Per Enhance + Generate: 4B 23.5 s, borrowed 26.3 s, so
  the borrow costs about 3 s and 4.7 GB more peak VRAM on this card, for the 8B writing the prompt
  (Fabio's quality call, 2026-09-13; now it actually happens).
- **Text-to-video through the agent** (turn 6a, Auto: "a short video of waves crashing on dark rocks
  at sunset, with the sound of the surf"): `list_models`, `read_knowledge guide:minimax-h3` and
  `minimax-h3:t2v`, then `generate minimax-h3 t2v_ms` with **`qualityTier: medium`, `turbo: true`**,
  ratio 16:9, a 151-word prompt, zero questions. Result in 196 s: `t2v_001.mp4`, 1344x768, 2.33 s,
  audio stream. Frames sampled: a wave bursting over dark rocks against the setting sun; audio
  `volumedetect` mean -30.3 dB, max -15.1 dB (audible surf). Note: 2.33 s is the length it got, and
  the agent has no duration param to ask for more (named params are ratio, quality, turbo, style).
- **Image-to-video with an attachment, first try: WRONG FRAMING** (turn 6b, `flowHeadSwap_002.png`,
  832x1024, attached: "Animate picture 1: he lifts the coffee cup and takes a slow sip"): one `look`,
  then `minimax-h3 i2v_ms`, `media: [{startFrame: att_...}]`, medium + turbo, **ratio 16:9**. Result
  in 241 s: `i2v_001.mp4`, 1344x768. Frames: the motion is right (cup up, sip), but the portrait start
  frame was cropped to landscape and the head is cut at the eyes. Audio mean -46.3 dB. Cause: the
  model never learns an image's size (the attachment line had none, `look` returns text), and H3's
  i2v offers the ratio picker. **Fix:** the attachment line carries `WxH`, a finished generation's
  note carries its `pixelDimensions`, and the Settings rule says an op that starts from an image takes
  the listed ratio closest to its size. `tests/agent-loop.test.cjs` 40/40; **bites 2/2 RED** (size
  dropped from the line, sentence removed); restored.
- **Image-to-video, second try** (fresh instance, same request and attachment, now listed as
  `832x1024`): `minimax-h3 i2v_ms`, **ratio 9:16**, medium + turbo, startFrame = the attachment.
  Result in 247 s: `i2v_002.mp4`, 768x1344, 2.33 s. Frames: the whole head in frame, he lifts the cup
  and sips; the cup sits at the left edge. H3 offers 1:1 / 9:16 / 16:9 / 21:9, so by aspect 1:1 is the
  nearest to 0.81 and would crop less (19 % of the height against 31 % of the width); the model kept
  the portrait orientation instead. Accepted: the subject is intact, which was the defect.
- **Harness after this session's prompt edits** (Numbering rule, Box rule, ratio sentence,
  "Never ask them to open or create a project first"): `--bite` **15/15**; 3 runs each **14/15**, the
  miss `memory-read` 2/3, then `--case memory-read --runs 6` **6/6** (a flake). Before the project
  sentence `create-then-generate` failed 1 in 3 (7/9 over two runs), and 4/6 with this session's new
  rules removed, so it predates them; with the sentence 6/6, then 3/3 in the full run.

### Install, live, in a sandboxed store (2026-09-17, session 047d6088)

- **The sandbox, and a trap on the way.** A second `app:isolated` with only `CUBRIC_MODELS_ROOT` on K:
  still listed every model installed and logged `free space — models root ... at G:/CubricModels`:
  the engine's `model_roots.json` custom root wins over the env var, which moves only the DEFAULT
  root (`getSearchedModelsRoots`). An install there would have written into the user's real store; the
  instance was stopped before anything was asked. The sandbox that works: `CUBRIC_ENGINE_ROOT` AND
  `CUBRIC_MODELS_ROOT` on `K:/mpi774-install-sandbox/`, seeded (`seed_sandbox.cjs`: version stamp,
  stub python, one-byte stubs for every universal-workflow dep, node folders with their pinned
  `.mpi_node_commit`), boot check `needsDepsInstall: false`. Boot logged no repair or download, free
  space `at K:\mpi774-install-sandbox\models`, 0 models installed, and it attached to the engine on 48188.
- **No:** "Install the Illustrious Anime model for me." -> `list_models`, `install_model ill-anime`,
  card `ILL Anime`, `downloadGb 8.8`; `POST /agent/confirm {yes:false}` -> the tool result "User
  declined the installation", `/comfy/downloads/status` jobs `[]`, the store held only the 11
  one-byte seeds.
- **Yes, first try: correct outcome, blocking path.** Same card, Yes -> a real download from
  models.cubric.studio, `ILL_Anime.safetensors` 6,938,045,570 B + the shared ControlNet 2,513,342,408 B,
  3 m 42 s (~42 MB/s), then the re-read and "ILL Anime has been installed successfully". But
  `POST /agent/confirm` held for the whole download: `downloadService.start()` returns the install
  CHAIN, which settles at download-done, and `agent.install-model` awaited it. The contract is
  `started: true`; awaited, the agent's one-turn lock is held for the whole download, and a download
  past the relay's 30-minute budget answers TIMEOUT while it carries on. **Fix:** not awaited.
- **Yes, second try (ILL Anime Beauty, 6.46 GB): the Yes call held 0.2 s**, the job `downloading`
  1.7 % three seconds later, the turn settled in 33 s, BUT the reply said "installed successfully":
  the loop's re-read found the ENTRY (every model is listed) instead of reading `installed`. **Fix:**
  `?.installed === true`. `tests/agent-loop.test.cjs`: the re-read decides the message, both ways,
  41/41; **bite** (entry-exists re-read) 1 fail; restored. Download completed (6,938,045,170 B); a new
  turn "Is ILL Anime Beauty installed now?" -> `list_models` -> "Yes".
- **Yes, third try (SDXL NSFW): the message was right and the model still misread it** ("Download
  started..." -> "The installation will begin once you click Yes"). The result now says it as a fact:
  "The user pressed Yes. X is downloading now (it shows in the app's downloads) and is not installed
  until that finishes." **Fourth (SDXL Realistic, 6.62 GB):** Yes held 0.2 s, job `downloading`, reply
  "It's now downloading in the background, you'll see it in the app's downloads panel"; after it
  finished (7,105,352,784 B), "Is SDXL Realistic installed now?" -> `list_models` -> "installed".
- The sandbox (`K:/mpi774-install-sandbox/`, 29 GiB now) and my two scratch profiles are left for
  Fabio to delete (agents do not hard-delete).

- **Fabio, 2026-09-17 (after this session's report):** the Agent toggle "looks good now" (the Studio
  head, Enhance-sized; Phase 3d item 6 closed). On the encoder borrow: **Klein must use its own
  encoder when ComfyUI runs the enhance**, "otherwise generations would take a lot longer". The fix
  stays; the measured +3 s per Enhance + Generate on this card does not change that decision.

## Phase 4 close (2026-09-17, session fa18265c) - compaction, honest limits, final harness

- **Where:** my own `app:isolated` (scratch profile, `CUBRIC_MODELS_ROOT=G:/CubricModels`,
  `DEEPINFRA_API_KEY` from the secrets file), ports 60023 then 64750 after a restart; `:3000`
  untouched; every agent turn under `gpu_lease.py run` (none generated). Driver `drive.mjs` (model pick
  + text from a file), pads of ~2.6k tokens (`pad.mjs`), all in the session scratchpad.
- **Side effect at boot, reported:** MPI-800's uncommitted `dev_configs/node_lock.json` pin was in the
  tree, so my boot's node drift repair pre-wiped the SHARED engine's `custom_nodes/ComfyUI-MpiNodes`
  and installed `cff4c3b3` (1.2.16) 3 s after READY. The engine on 48188 was not restarted (it runs the
  1de35a33 code it loaded). That is the sha MPI-800's Phase 2 wants; nothing reverted; MPI-800 told
  (message `b800d1f7`) and keeps it (reply `2951155f`: Fabio's full app restart finishes it). My pre-boot check named `routes/ server.js services/ main/` but not `dev_configs/`.

### Compaction, live (Qwen/Qwen2.5-72B-Instruct, 32,768 window, trigger 16,384)

- **Run 1 (as committed):** turn 0 set the goal ("six-shot storyboard, The Last Lighthouse", teal and
  amber + fog, Krea 2 at 3:2, open: whether the robot gets a name; no notes, no generation), then pads.
  prompt_tokens 4,244 -> 6,892 -> 9,489 -> 12,103 -> 14,704 -> **17,309**: on that turn
  `agent:compacting` `on: true` at 2.9 s, `on: false` at 14.1 s (same `turnId`), and `/agent/history`
  gained a `handoff` entry with all five fields (Goal; Decisions Made; Outputs Generated: none; Current
  Model and Settings: Krea 2, 3:2; Open Questions: the robot's name, and what each shot shows). The goal
  turn and pad P were dropped (kept: the last 4). Recall turn (14,894 tokens): goal, look, Krea 2 at 3:2
  and the open name question, all right, and no tool called.
- **Defect found live: it then compacted on EVERY turn.** A `list_models` turn went to 24,622 tokens
  (the answer alone ~9.5k) and compacted; the next PLAIN turn was still 19,782 and compacted again:
  3 handoffs in 3 turns. Cause: the restart kept the last 4 turns whatever their size, so the restart
  itself sat above the trigger (and a bigger turn would overflow the window). Brief item 15 says "the
  last few turns"; 4 was ours. **Fix** (`services/agentLoop.mjs`): keep the newest turns, at most 4,
  that fit in half the trigger, sized by the last call's tokens per char (no tokenizer; tool schemas
  add tokens without chars, so it over-counts). `tests/agent-loop.test.cjs` "a compaction keeps only
  the recent turns that fit in half the trigger": 42/42 (+1 live skip). **Bite** (no budget): 1 fail;
  restored. `eslint` on both files exit 0. `docs/agent-chat.md` § Loop rules updated.
- **Run 2 (fixed, fresh instance, fresh conversation):** same goal + pads, 4,244 -> ... -> 14,673 ->
  **17,268**, compacted (on/off pair). Recall at **9,593** (was 14,894): right on all four points. The
  `list_models` turn: 19,326, compacted once (its own prompt crossed). Then three plain turns at
  **4,421 / 4,508 / 4,594**, no compaction (before the fix: every one). Shot 1 answer still used the
  goal; the last turn restated the goal and the open question correctly after TWO compactions.
- Mascot / "compacting" line: the UI half is `agent-chat.spec.js` "agent:compacting renders compacting
  line" (below); the live events above are what drive it. Fabio sees it in Phase 5.
- Model nit, not ours: Qwen listed Krea 2's ratios without 3:2 and said "3:2 is supported"; the
  Settings rule and the named-param check refuse an unlisted ratio at generate time.

### Honest limits, live (the default agent model, DeepSeek V4 Flash)

- **"Watch the video I made earlier, t2v_001.mp4 ... tell me if the motion looks smooth."** No tool
  call. Reply: "I have an honest limit: I can't watch videos. I can only look at still images ... I
  can't judge motion smoothness from a single still", and offered to look at an attached still.
  Nit: its last line offered to look at "that image" from the gallery, which it can reach only if the
  user attaches it.
- **A REAL Remote describer refusal.** Probe first: `POST /llm/describe` (Llama-4-Scout) with "Identify
  this person by name." on `t2i_002.png` -> `ok: true`, "I can't identify people based on their image."
  Then a playwright page on MY instance with `cubric.llm.describeBackend = endpoint` (the relay feeds the
  newest window; closed right after; no ComfyUI describe ran, per 48188 `/history`). First try ("tell
  me who this man is"): the agent asked the describer for identity AND appearance, so it described, and
  the agent said it cannot identify him. Second try, the question pinned ("Use look on picture 1 with
  exactly this question ..."): `look {image: att_cb4239e0, question: "Identify this person by name."}`
  -> the refusal text (2 s); the reply quoted it, said "the describer declined to identify the person
  by name ... this is the remote describer declining; if you'd prefer one that runs locally on your
  machine (which won't refuse), you can switch Image descriptions in **Settings > Remote > Language
  Models**." The harness case `look-refusal` covers the unpinned path with a fake refusal.

### Suites (after the fix)

- `npm test`: 1312 tests, 1305 pass, **6 fail, all in MPI-800's in-flight workflow rework** (38 files
  mid-edit by a live peer): `tests/workflow-media-slots.test.cjs` (untracked, 4), and
  `tests/flow-model-choice.test.cjs` / `tests/flow-required-media.test.cjs` (modified by that peer).
  None imports the agent loop.
- `tests/desktop/agent-chat.spec.js` (private `--output`): 25/26; the miss was "Mascot flips back to
  idle" with `shellWindow: no 127.0.0.1:63285 window within 30000ms` (the app never showed its
  window); alone: 1/1 pass.
- `npm run agent:test -- --bite`: **15/15 bite**, $0.034.
- `npm run agent:test` (3 runs per case): **15/15 cases, 45/45 runs** (no `memory-read` flake this
  time), $0.087. Both harness runs used the tree with the compaction fix.

## Phase 5 - Fabio's first round (2026-09-17/18, his app, "New Project")

Read off disk (his chat lives in the server's memory; `:3000` is his session and my Bash guard
refuses to read it). Sources: `New Project/Media/.meta/*.json` and `New Project/Agent/`.

- **Head Swap picked up the wrong woman. Cause, from the sidecar:** `flowHeadSwap_001`
  `box1 {x: -245, y: 594, w: 1166, h: 1166}` on a **1664x2304** source, and
  `box2 {x: -201, y: 173, w: 1171, h: 1171}` on a **768x1344** source - box2's side is WIDER THAN
  THE WHOLE IMAGE. Both squares keep the raw box's longer edge, so the raw boxes were ~1166 px TALL:
  the describer boxed the whole woman (head to waist), not the head, and `square` then matched that
  height in width, which swallowed the neighbour and ran off the left edge. Two holes: (1) nothing
  checks that a "head" box is head-sized, on a group photo the describer over-boxes; (2) `square`
  inflates without a limit or a warning, and `overflow: 'allow'` means no one refuses it.
- **Model choice: an edit went to `krea2Edit` (`edit_001`) with `klein-9b` installed** (`edit_002`
  is the same edit on `kleinEdit`). Nothing in `list_models` says which model OWNS an op: ops are a
  flat `supportedOps` list, and Krea 2's edit is an adapted path (`Input_wf_type: 4`) while Klein 9B
  is the native editor. Fabio: prefer Klein 9B. Needs a preference the catalog carries and a Model
  rule line.
- **The agent's colour is wrong:** `MpiAgentChat.css` uses `--accent-heat` (Vision rose). The agent is
  Studio, so it should read the cream `--hub-accent` (whose comment today says identity only, never
  an action colour - that line moves or a new token is added).
- **Remote > Language Models looks broken while it loads:** the connection block renders its labels
  (Provider, Base URL, API key, Prompt enhancement, ...) with empty values until the backend answers.
  Needs a loading state (spinner or the mascot).
- **Memory:** `Agent/README.md` + `characters.md` exist, saved from an explicit "remember ... John
  and Maria". The Memory rule already tells it to save unprompted; live it needed telling.
- **Renaming a project:** it correctly said it cannot - no tool renames a project (`rename_card` is
  cards only). Checklist line 16 (never deletes) is proven by that refusal. Its advice was RIGHT, not
  invented: `js/shell/projectUI.js:575` puts "Rename project" in the project card's menu.
- **The transcript** (Fabio pasted it, 2026-09-18): the cat t2i read `guide:sdxl`; the guinea pig
  matched the environment with no new guide read; "edit picture 1 ... night environment" read
  `guide:krea-2` and ran Krea 2; only "please use Kline9b" made it read `guide:flux-2` and run
  `kleinEdit`; the head swap ran after two looks; the LTX install card was declined and it then
  offered `ltx-23` (~58 GB) and `ltx-23-balanced` (~39 GB) with the fit note; the memory note landed
  only on "Don't forget that, okay?".

- **Memory across a restart: PASSED (Fabio, 2026-09-18).** After a full app restart, in the same
  project (since renamed "2-character test"; a rename changes the display name only, never the
  folder), "Hey Studio, I can't remember what I was supposed to do in this project. Can you remind me
  please?" -> `read_memory` + `list_projects`, then the note read back: John now, Maria later, and it
  offered to start John. Checklist line 15 is proven.

### Fabio's decisions on those findings (2026-09-18)

- **Model priority is a RANKED LIST per task, not one featured model:** best, second, third, ... per
  task, and the agent takes the highest-ranked INSTALLED one unless the user names a model. Ops are
  per-model ids (`kleinEdit`, `krea2Edit`, `qwenEdit`, `edit`), so the table is keyed by TASK and each
  entry is a `{modelId, op}` pair; `/connector/models` carries the rank and the Model rule reads it.
  The order itself is Fabio's to give (candidates below).
- **Colour:** everywhere the agent surfaces use pink today becomes `--hub-accent` (Studio cream).
  That is the agent chat, the panel and the agent box, including buttons and active states.

Candidates to rank (from `js/data/modelConstants/models.js`): **edit** - klein-9b `kleinEdit`,
boogu-edit-high / boogu-edit-balanced `edit`, qwen-edit `qwenEdit`, krea2 / krea2-nsfw `krea2Edit`.
**t2i / i2i / control / inpaint / upscale / detail** - krea2, krea2-nsfw, klein-9b, klein-4b,
chroma-flash, chroma-hyper, sdxl-realistic, sdxl-nsfw, ill-anime, ill-anime-beauty, pony-mix.
**t2v** - minimax-h3, ltx-23, ltx-23-balanced, wan-22 (`t2v`), wan22-5b. **i2v** - minimax-h3,
ltx-23, ltx-23-balanced, wan-22, wan22-5b. **ref2v** - minimax-h3-ref2va. **pid** - nvidia-pid.

## Phase 5 - Fabio's pass (checklist; one action, one result per line)

**First: quit the app and start it again.** A reload is not enough (the agent runs in the server;
MPI-800 needs the same restart).

1. Settings > Remote > Language Models -> the connection block is on top; the Agent row shows Remote, a model, the mode and a tool test that passes.
2. Landing page, agent box beside the headline: type "make a picture of a cat on a windowsill", Enter -> the mascot works, a "New Project" is created and opened, the chat moves into it, a result card lands and opens the card when clicked.
3. Landing page: "start a new project for a comic about a fox detective" -> a project named after it, opened, a "Noted:" line, then it asks what to make first and generates nothing.
4. In a project, press the Studio head beside Enhance -> the agent panel opens on the left, full height; the prompt box shows only its text and the head, with a hint.
5. Press the head again -> Prompt mode, with the prompt you had before still in the box.
6. Drag the panel's right edge -> it resizes; reload -> the width stays.
7. Drop two images into the box -> chips numbered 1 and 2.
8. "Edit picture 1: give him the hair of the person in picture 2" -> it looks at both, edits picture 1 (not an older image), the chat never shows the prompt, a result card lands.
9. After any image result -> a "Looking at image" line follows; it never regenerates on its own.
10. "Make a short video of waves on rocks" (Auto) -> no questions, video at medium + turbo.
11. Head Swap: drop two portraits, "put the head from picture 2 onto the person in picture 1" -> it measures both heads (look lines), runs Head Swap, the result is a clean swap.
12. Agent mode Ask first (Settings) -> "make an image of a red bicycle" -> it asks about the settings before generating.
13. "Install <a model you do not have>" -> a Yes/No card with the size; No -> nothing downloads; Yes -> it shows in Downloads and the reply says it is downloading.
14. "Watch my last video and tell me if the motion is smooth" -> it says it cannot watch videos, only still images.
15. "Remember that the hero is called Rook" -> a "Noted:" line and a note in `<project>/Agent/`; restart the app; "what is the hero called?" -> it reads the note and says Rook.
16. "Delete the last card" -> it says it cannot delete and tells you where you can.
17. Switch to another project and back -> each project shows its own conversation.
18. Image descriptions = Remote, drop a portrait, "use look with exactly this question: Identify this person by name." -> it says the describer refused and names Settings > Remote > Language Models.
19. (Optional) Pick a small-window agent model (e.g. Qwen/Qwen2.5-72B-Instruct) and chat long -> a "Compacting" line with the mascot, and it still knows the goal afterwards.

## Phase 5 fixes 2-7, built (2026-09-18, session 627f63f6)

Fix 1 (ranked model priority) is NOT here: Fabio gave his order this session and it needs a
conversation first — see § "Fabio's order" below.

**2. A head box that is not head-sized (`routes/connector.js`, `services/agentLoop.mjs`).**
A `box: true` look now answers with `imageSize`, `boxShare` and `squareShare` beside `box` and
`square` (`boxShare()`, exported on the router; the metadata read it needed was already in the
branch, so no second read of the image). The route still squares and still allows the overflow —
what changed is that the caller can now see what it is holding. The Box rule refuses a
`squareShare` over 0.6 on either side, or over 1, and measures again with a head-only question or a
crop; a second bad measure ends in telling the user which photo it cannot measure.
- 0.6 is measured, not picked: the three Phase 4 head boxes square to 0.14, 0.52 and 0.46, and the
  two live over-boxed ones are 0.70x0.51 and 1.52x0.87. The first draft used 0.5 and the test caught
  it — t2i_002 is a close portrait whose real head squares to 0.52.
- `tests/connector-agent-tools.test.cjs`: two cases on those recorded numbers, 18/18 in the file.
- Harness `over-boxed-head`: Head Swap on two portraits where picture 1's "head" is the whole woman
  -> it never runs the Flow and says what is wrong with the measurement. Its flip (a real head box)
  runs Head Swap, so the assertion bites.

**3. Studio cream, not Vision rose (`MpiAgentChat.css`, `MpiPromptBox.css`, `styles/01_base.css`).**
`.mpi-agent-chat` and the prompt box's `__col--mode` rebind `--accent-heat: var(--hub-accent)` for
their subtree. One line per surface instead of four literals, and it is the only form that also
catches the Primitives mounted inside them: MpiButton reads `--accent-heat` directly for its hover,
`:active` and `.is-active` states, so a literal swap would have left the agent's head ringed rose
when toggled on. The token comment now records that exception instead of "never an action colour".

**4. Language Models loading state (`MpiLlmSettings.js/.css`).** `_init` wraps its two awaits in
`_setLoading(root, true)` / `finally false`: an `MpiSpinner` and "Checking the connection…" show
while the subgroups stay out of the flow, so a cold open no longer paints Provider / Base URL / API
key / Prompt enhancement with nothing under them. The spinner is destroyed with the other controls.

**5. Memory saved without the cue (`services/agentLoop.mjs`).** The Memory rule now names the moment
rather than the judgement: the turn the user states a goal, names a character, settles a look,
decides something, or a setting works or fails, call `write_memory` — they will not ask, and a turn
that ends without the note loses it; saving is never a question to put to them.
- Harness `memory-write-unprompted`: "The hero of this project is Rook, a one-eyed crow ... make an
  image of him on a rooftop at dusk" -> a note holding Rook AND the picture still made. Flip
  (`memoryFull`) bites.

**6. Stop is reachable in Agent mode (`MpiPromptBox.css`, `.js`) — new, from Fabio's second look.**
Agent mode hid `.mpi-prompt-box__col--run` wholesale, and that column holds Run, Stop and Clear, so
while the agent generated there was no way to stop it: he watched the latents arrive and asked the
agent to cancel, which it cannot do and correctly said so. The column now stays, with everything in
it hidden but `.mpi-prompt-box__stop-host`, and the grid gets its third track. No new button and no
new event: `pb.on('cancel')` -> `cancelRunningCueJob` / `activeGenerations.cancel` is origin-blind,
and `_refreshPbGenerating` already arms it from `activeGenerations`, which an agent generation
enters like any other.

**7. A video result is a `<video>` (`MpiAgentChat.js/.css`) — new, same look.** `_appendResult` built
an `<img>` for every result whatever its type, so a video result could never paint: the broken tile
in his screenshot is that `<img>` with `alt="video"`. A video now mounts a muted
`<video preload="metadata">`, and an `error` on either element swaps in a dashed "Did not finish"
tile — which is also what a stopped generation's missing file shows, instead of a broken box.

**Checks.** `node --test tests/connector-agent-tools.test.cjs` 18/18 ·
`node --test tests/agent-ui-surfaces.test.cjs` 5/5 (new file: the four UI contracts, asserted where
they are declared — this suite has no DOM runner) · `npm run lint:components` clean.

**A harness fix the box case forced.** A case's `look` was ONE fixture for every image, so two
portraits answered identically and the model concluded the describer was broken and stopped —
neither the pass nor the bite measured anything. `look` now also takes a map keyed by the
attachment's `filePath` (the loop resolves a ref to a path before calling, so an attachment id never
reaches the fake).

### Fabio's order for fix 1, and what it exposed (2026-09-18)

His ranking, verbatim in intent:

- **edit** — 1. Boogu (*best editor we have, but it takes ONE image only*) · 2. Klein 9B ·
  3. Klein 4B · 4. Krea 2 (*faster than Qwen Edit, but has limitations*) · 5. Qwen Edit.
- **video** — MiniMax H3 · LTX 2.3 balanced · WAN 2.2 · WAN 2.2 5B · **then** LTX 2.3 (not balanced)
  last. "Reference to video is different."
- Not a ranking at all, but the thing a ranking cannot hold: **Qwen Edit does not touch anything
  outside the edit area**, where the others drift the surroundings. **Chroma** is the candid /
  influencer / real-life look; **Krea 2** is realism; **SDXL realistic** is old and no longer
  realistic in the current sense — Klein 9B beats it. He also asked whether the agent knows about
  **control** (editing through a depth map), and whether it reads the user's hardware.

Checked against `js/data/modelConstants/models.js` (`supportedOps`), because a `{modelId, op}` table
cannot name a pair that does not exist:

- `klein-4b` DOES carry `kleinEdit`, so his #3 is a real entry.
- `wan-22` carries **`i2v_ms` only** — there is no WAN 2.2 entry for a t2v ranking. The candidate
  list at the top of this section had it under t2v; that was wrong.
- `qwen-edit` carries `qwenEdit` AND `control`.
- Editing ops, per model: `edit` (boogu-edit-high, boogu-edit-balanced), `kleinEdit` (klein-9b,
  klein-4b), `krea2Edit` (krea2, krea2-nsfw), `qwenEdit` (qwen-edit).

**Hardware: yes, already.** `GET /connector/models` serves `hardware {gpuName, vramGb, ramGb}` and,
per model, `fit {floorVramGb, ramGbAtYourVram, runs}` plus `missingDownloadGb`; the `list_models`
tool description says "hardware fit" and the agent used it live in round 1 when it offered `ltx-23`
(~58 GB) and `ltx-23-balanced` (~39 GB) with a fit note. So a rank does not need to encode what the
box can run — `runs` already says it.

### Fix 1 built: ranked model priority (2026-09-18, same session)

`js/data/modelConstants/modelPriority.js` — `opPriority(modelId, op) -> { rank, note } | null`,
served onto every op by `GET /connector/models` and applied to the harness fixture by the same
function, so the harness sees what the app serves.

- **One order for all six image tasks**, filtered by `supportedOps`: krea2, klein-9b, chroma-flash,
  chroma-hyper, klein-4b, sdxl-realistic, then the three anime/stylised ones. Chroma has no
  `inpaint`, so it drops out of inpaint and klein-4b moves up — no second hand-written list to drift.
- **edit** (ops differ per model): boogu-edit-high, boogu-edit-balanced, klein-9b `kleinEdit`,
  klein-4b `kleinEdit`, krea2 `krea2Edit`, qwen-edit `qwenEdit`.
- **t2v**: minimax-h3, ltx-23-balanced, wan22-5b, ltx-23. **i2v**: minimax-h3, ltx-23-balanced,
  wan-22, wan22-5b, ltx-23. (`wan-22` has no t2v op, so it cannot be in the t2v list.)
- **Notes, not just ranks** — Fabio's own point: Qwen Edit is last on speed and first on "changes
  nothing outside the edit area", which is the whole request for some edits. A note exists only where
  it changes the pick: one image only (Boogu), the surroundings drift (Krea 2 Edit), candid/real-life
  (Chroma), older standard (SDXL realistic), anime and stylised (Illustrious, Pony).
- **Unranked on purpose:** every `-nsfw` variant (an agent must not drift to one on its own) and the
  single-candidate tasks `ref2v`/`pid`.
- **The Model rule** now reads rank + fit: take the lowest rank among installed ops that RUN on this
  machine; go lower only for a named model or a matching note, and say in one line why.
- **Hardware was already there** and needed nothing: `fit.runs` per model, `hardware.vramGb`, and the
  tool description says so.
- `tests/model-priority.test.cjs` 5/5 — every ranked pair exists in `models.js` and declares that op
  (the drift failure: a table naming an op a model no longer has ranks nothing, silently), the order
  is the one given, the image filter behaves, the notes are on the entries that need them, and
  nothing `-nsfw` or single-candidate is ranked.
- Harness `ranked-editor`: with klein-9b and krea2 installed and every other editor not, an edit runs
  `kleinEdit`; "do that edit again with Krea 2 instead" runs `krea2Edit`. Flip (klein-9b not
  installed) bites.
- `docs/playbooks/add-model/`: a checklist line and a section in `03-model-registry.md` — a model
  missing from the table is invisible to the agent's preference, which reads as the agent ignoring
  the model the user just installed.

### Suites

- Full harness **17/17 cases 3/3** ($0.1235, 51 conversations) on the tree with fixes 2-7 — before
  fix 1's rule edit. The final full run + `--bite` on the complete tree is recorded below.
- `node --test tests/connector-agent-tools.test.cjs` 18/18 · `tests/agent-ui-surfaces.test.cjs` 5/5 ·
  `tests/model-priority.test.cjs` 5/5 · `npm run lint:components` clean.

### Final suites (2026-09-18)

- `npm run agent:test --runs 3`: **18/18 cases 3/3**, $0.1544 for 54 conversations — then the Box
  rule gained its "measure again ONCE" sentence (below), which is in every case's system prompt, so
  the whole suite + `--bite` was re-run on the final tree. Those numbers are at the end of this file.
- `npm test`: **1342 pass, 0 fail, 1 skipped** (1343). The six MPI-800 failures in yesterday's
  baseline are gone — that peer's in-flight workflow rework landed.
- `npm run lint:components` clean. `node --test` on the three touched/new files: 18/18, 5/5, 5/5.

**The bite caught one of my own cases passing for the wrong reason, and then the case caught a weak
rule.** `over-boxed-head` bit alone, did NOT bite in the full run, then bit on `STEP_LIMIT` — three
outcomes, none about the box. Two causes, fixed in turn:

1. **The scene was deciding the result.** The case described TWO women in picture 1, so the flip (a
   real head box, which has to go on and RUN Head Swap for the assertion to fail) spent its whole
   8-call budget telling them apart. Both box fixtures now describe ONE subject, the request carries
   no left/right, and the attachment FILENAMES agree with the descriptions — `two-women.png` against
   a one-woman description sent the model hunting for the discrepancy instead of measuring, and a
   man's donor face against a woman's photo did it again.
2. **"Measure again" had no end.** With every measure coming back over-boxed the model kept
   re-cropping — 12 look calls, 100-140 s turns, and one run lost to a transient
   `ENDPOINT_ERROR: fetch failed` mid-turn. The Box rule now says measure again ONCE, then stop and
   tell the user which photo you could not measure and ask them to crop it. Calls per run fell from
   8-12 to **4-6**, and the case went 3/3 with the bite biting in 4 calls. That is a live saving,
   not a test fix: the same loop was burning the same budget in the app.

Recorded in `docs/agent-chat.md` § Loop rules: a case's scene is part of its assertion.

**A rank invites a TASK switch — caught by `ranked-editor`, 1/3 on the first full run.** Asked to
"do that edit again with Krea 2 instead", the model ran **krea2 `i2i`**, and said why in its own
reply: "Krea 2's i2i, its best realism op, rank 1". It was not ignoring the ranking, it was obeying
it across a task boundary — re-lighting a photo reads as a description-level job, and i2i ranks 1
for i2i. The user had named a model, not a different task, and i2i re-generates from a description
where the edit ops preserve the picture.

The Model rule now opens with the task: the task comes from what the user asked for and does not
change because another task's op ranks higher (changing an existing picture is the edit task, even
when the named model's i2i is rank 1), and ranks only ever compare ops WITHIN one task. After that
edit: `ranked-editor` 3/3, 7 calls a run, and its bite bites.

This is the failure mode to watch when ranking anything else: a number attached to an op is read as
a number attached to the WORK, and the model will cross tasks to reach a 1.

### Suite state at handoff (2026-09-18, session 627f63f6)

Every rule edit lands in every case's system prompt, so the suite was re-run after each one. The
last complete full run on the FINAL tree:

- `npm run agent:test --runs 3`: **16 of 18 cases 3/3**; `create-then-generate` and
  `memory-write-unprompted` came back **2/3**. Both are **3/3 when re-run alone** immediately after
  (6/6 conversations, $0.0248), and both were 3/3 in the two earlier full runs.
- **I did not capture the two failing runs' detail** — the command grepped the summary lines only.
  So I cannot say whether they were transient (`ENDPOINT_ERROR: fetch failed` hit a run earlier in
  this session, mid-turn, and reads as a case failure) or real model variance. **First check next
  session:** re-run the full suite keeping the per-run output, and if either fails again, read its
  calls before touching a rule.
- `--bite` on the final tree landed just after the handoff was written: **18/18 biting**, $0.0534.
  Every assertion in the suite, including the three added this session, can see the failure it names.
- Not in doubt, all on the final tree: `npm test` **1342 pass / 0 fail / 1 skipped**, `npm run lint`
  and `lint:components` clean, `node --test` on the three unit files 18/18 + 5/5 + 5/5.

Total spend on the harness this session: ~$0.60 across the reruns.
