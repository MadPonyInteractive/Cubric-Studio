# MPI-965 - Community agent benchmark: share, show, leaderboard

## Current State

**2026-09-29 ~11:15, HANDOFF (session 4a2a917e):** everything but the benchmarks is shipped. Fabio approved the
copy (validation.md) and PUSHED the privacy page himself (Website `0df6b76` on origin; the agent's push was
refused as a production deploy). Worker in mpi-ci `ba4c5b3`. App code committed + pushed to master by this
handoff. LEFT on this card: the four Ollama benchmarks with Share (recipe below; only when Fabio says his
generations are done), stamp the scores into `RECOMMENDED_REMOTE_MODELS.ollama`, check the page lists them,
then close-out. Fabio's NEXT priorities are other cards: MPI-894 Phase 1c (GPU picker overlay), then MPI-970
(agent routines brainstorm).

**2026-09-29 10:40:** Phase 3 run is ON HOLD until Fabio says his generations are done (a local model
shares his card; he quit Ollama). How to run it without his app: `node scripts/launch-instance.mjs`
(background; READY url in its output), then `gpu_lease.py run node scratchpad/bench965.mjs <url> <model>`
(drives GET/POST `/agent/benchmark` with `share: true` and reads `bench:done` off `/agent/stream`). Close
the instance by its root pid (listener's PARENT), never :3000's. Ollama must be started first (he quit it);
never check it with the `ollama` CLI (it relaunches). A granite4.1:8b run was stopped at case 2 on his ask:
`bench:done` said `stopped, errored, shared:false, "a stopped run is not shared"` (stop path proven live).

**2026-09-29 ~10:45, session 4a2a917e:** PHASE 2 DONE: the Worker is LIVE at https://bench.cubric.studio
(workers.dev off), D1 empty, SALT set, `wrangler.jsonc` carries the real database_id + the custom-domain
route (uncommitted in mpi-ci). **Next: Phase 3** - Fabio restarts his app on the working tree, ticks Share,
benchmarks `qwen3.6:35b` on Ollama (pulled, plus `granite4.1:8b`; his picks = ours: qwen3.6:35b, re-run
ornith:9b + gemma4:12b, then granite4.1:8b). Then stamp those scores into `RECOMMENDED_REMOTE_MODELS.ollama`
(`services/llmEngines.mjs:522`, NOT in the claim yet: extend it first) with the suiteHash. Virgin Media DNS
cached bench's NXDOMAIN at ~10:20: a share before ~10:50 reads "could not reach".

**2026-09-29 10:05, session 4a2a917e (tab "Agent 63"):** Parallel Batch DONE and verified (validation.md):
A1 Worker in `mpi-ci/cubric-bench/` (uncommitted, 44/44), A2 app in Vision (uncommitted, 38/38 + desktop
2/2 + eslint 0), A3 privacy commit `0df6b76` in the Website repo (local, NOT pushed). End to end: A2's
`benchCommunity.mjs` against A1 under `wrangler dev --local` 11/11 (scratchpad `e2e965.mjs`). All under ONE
claim record `state/files/4a2a917e-mpi965.json` (`scratchpad/claim965.py` re-registers it). Peer message
ec93cbba resolved (events.js:187). **Next: Phase 2 with Fabio at the keyboard** (wrangler login, free-plan
check, d1 create, deploy, smoke with `node scripts/smoke.mjs <url>` without `--full`, his yes for the domain).
Nothing is committed yet: commit Vision + mpi-ci at handoff/close-out (mpi-ci is a separate repo; cubric-bench
is a new folder there, `.dev.vars` / `.wrangler/` / `node_modules/` ignored).

2026-09-29, session 8d7c61a8. Design approved by Fabio in brainstorm: `brief.md` (scope C, page on the service,
tickbox before the run, one number per model with community third). Investigation: `research/findings.md`.
Project mode `scalable-foundation`: every decision below is settled; the only open items are Fabio's gates
(Cloudflare login, the custom domain, the privacy push, the copy look), each placed in the phase that needs it.

**Decided (with why):**
- **Worker lives in `C:/AI/Mpi/mpi-ci/cubric-bench/`** (private repo, beside the Pod image = precedent for
  product server code). NOT `workers/` in Vision: `scripts/build-portable.mjs` is a denylist, it would ship.
- **Cloudflare Worker + D1, free plan, `wrangler` as a devDependency of that folder** (never global). Deploy
  by hand from this machine like the R2 uploads; no CI deploy (nothing else deploys Cloudflare from CI).
- **Upload from the app's SERVER** (`AgentSessions._runBench`), never the renderer: it holds the per-case
  results, runs with Settings shut, needs no CORS.
- **A run is shared only when whole AND clean:** not stopped, and no case failed with `agent:error` / `crashed:`
  (a 402 or a dead host reads as a full run of fails). **The same check stops such a run being KEPT locally**
  (an MPI-941 hole: today a connection that dies mid-run replaces the row's score with a bogus low one).
- **`failures` text is never uploaded** (model-chosen paths and ids); only `{ id, pass }` per case.
- **Allow-list presets** `deepinfra`, `openrouter`, `openai`, `ollama` (profile ids beyond the five exist);
  the tickbox shows only for those.
- **Keyed by preset + exact model id + suite hash.** Community score = lower median of `passed`, median
  `perChat`, only with >= 3 runs; the app shows the current suite only.
- **Community GET only from `GET /llm/connection/models`** (the probe route and `agentLoop` also call
  `listRemoteModels`), 24 h cache per suite, a failure remembered 10 min, 3 s timeout, `null` on any failure.
  `CUBRIC_BENCH_URL` overrides the base; `off` disables it (tests).
- **Share pref = its own Storage key** (`mpi_agent_bench_share`): `normalizeAgentPrefs` drops unknown fields.
- **IP never stored:** `sha256(ip + day + SALT)` in a `rate` table, 10 posts a day, rows older than 2 days
  deleted on write. `SALT` is a Worker secret.
- **Every string the page prints is HTML-escaped** (model ids are attacker-controlled).

**Constraint:** no build reaches a tester between the app batch landing and Phase 3's privacy push: the page
would be false. The agent is unreleased (2.0), so no release-notes entry is owed.

## Contract v1 (both halves build against this)

`POST /v1/runs` JSON: `{ v: 1, preset, model, suite, results: [{ id, pass }], perChat, app, secPerCase,
gpu?: { name, vramGb } }` -- `model` 1-200 printable chars; `suite` `/^[0-9a-f]{12}$/`; `results` 1-100, `id`
`/^[a-z0-9-]{1,64}$/`, unique; `perChat` number 0..10 or null (USD per test chat; was 0..1, see Drift); `app` semver-ish <= 32; `secPerCase` 0..3600;
`gpu` only for `ollama`, `name` <= 80, `vramGb` 0..512. Server computes `passed`/`cases`. Answers `201 {ok:true}`,
`400 {ok:false,error}`, `429 {ok:false,error:'RATE_LIMIT'}`, `413` over 16 KB.
`GET /v1/scores?suite=<hash>` -> `{ suite, models: [{ preset, model, runs, passed, cases, perChat }] }`, runs >= 3,
`Cache-Control: public, max-age=3600`. `GET /` -> the page. Anything else 404.

## Completed

- [x] Brainstorm + design approved (brief.md); investigation (research/findings.md).

## Remaining Work

## Parallel Batch: build both halves and the privacy draft

Run through `mpi-execute-parallel`: the three tasks share no file and build against the contract above.

- [x] **A1 Worker.** `cubric-bench/`: `package.json` (devDep `wrangler`, pinned), `wrangler.jsonc` (D1 binding
  `DB`), `schema.sql` (`runs`: id, at, preset, model, suite, cases, passed, results JSON, per_chat, app,
  sec_per_case, gpu, vram_gb, index (suite, preset, model); `rate`: day, ip, n, PK (day, ip)), `src/logic.js`
  PURE (validate, lower median, aggregate by (preset, model), most-failed tests, `renderPage` with escaping),
  `src/index.js` (router, rate limit, insert, Cache API on scores), `test/logic.test.mjs`, `README.md` (deploy
  steps). Page: newest suite first, a table per provider (model, runs, median score, cost, GPUs for local),
  then the most-failed tests; plain HTML + inline CSS, no JS, no external assets.
  Ownership: `C:/AI/Mpi/mpi-ci/cubric-bench/**`. Briefings: none (new code, own repo) + the Critical Rules
  Snapshot's no-secrets line. **Verify:** `node --test test/` green (validation rejects each bad field, median,
  aggregation >= 3, an `<script>` model id renders escaped); `npx wrangler dev --local` with the schema applied
  answers a valid POST 201, a bad one 400, the 11th POST 429, `GET /v1/scores` the aggregate, `GET /` the page.
- [x] **A2 App.** New `services/benchCommunity.mjs` (`shareRun`, `communityScores`, base URL + `off`);
  `services/agentSessions.mjs` (`benchmark(profileId, model, { share })`, per-case seconds, clean-run check,
  upload before `bench:done`, which gains `shared`, `shareError`, `errored`); export `getVramStats` from
  `routes/system.js`; `routes/agent.js` (read `share`); `routes/llm.js` (merge `communityTest` in the models GET);
  `js/services/agentService.js` (do not keep an errored run; toast says shared / not shared);
  `MpiLlmSettings.js/.css` (MpiCheckbox in the confirm step, allow-listed presets, remembered; posts `share`;
  end line; `scoreOf` third tier + "(community, N runs)"; "See everyone's results" via `openExternal`; hint copy
  below); `js/core/storage.js` + `storageKeys.js` (share key); `js/events.js` (bench:done fields); tests:
  `tests/agent-bench.test.cjs`, `tests/llm-connection.test.cjs`, new `tests/bench-community.test.cjs`,
  `tests/desktop/llm-settings-remote.spec.js`; docs: `docs/agent-chat.md` (routes + the privacy line, as
  `docs/dictation.md` does), `docs/llm.md` (<= 200 lines).
  Copy (Fabio judges it in Phase 3): tickbox "Share the result anonymously"; its hint "Sends the model, its
  scores, cost and your GPU. Never prompts or keys. Shown at bench.cubric.studio."; the bench hint becomes
  "Runs our 28 agent tests on this model with pretend tools: nothing is generated or added to your projects."
  Ownership: the files named in this task. Briefings: `mpi-brief-rule components`, `state`, `events` + the
  Critical Rules Snapshot. **Verify:** RED first for the clean-run check and the upload; `agent-bench`,
  `llm-connection`, `bench-community` green with global fetch stubbed (no real network); desktop spec 2/2
  (checkbox hidden for custom, remembered, body carries `share`, "(community, 3 runs)" label and ranking,
  link calls openExternal); `npm test` 0 fail; eslint 0; `docs/llm.md` <= 200 lines.
- [x] **A3 Privacy draft.** `C:/AI/Mpi/Cubric Studio (Website)/privacy/index.html`: two `<h3>` entries after
  "The assistant and prompt tools" ("Agent benchmark sharing (only if you tick Share)", "Community benchmark
  scores"); reword L11 meta + L69 "no telemetry", L77 "only goes online...", L120 "the only personal data"
  (hashed IP, rate limit, 2 days, legitimate interests, Cloudflare); bump "Last updated" + the audit comment.
  COMMIT LOCALLY, NEVER PUSH (Fabio's yes, Phase 3). Ownership: that one file. Briefings: Critical Rules
  Snapshot. **Verify:** every false line from `research/findings.md` § Privacy is changed (grep), the page
  opens in a browser, `git -C` shows one local commit, nothing pushed.

## Phase 2: go live (Fabio at the keyboard for the gates)

- [x] `npm install` in `cubric-bench/`; Fabio runs `npx wrangler login` (browser). Confirm the account is on the
  Workers FREE plan: this phase must cost $0; any paid prompt = stop and ask.
- [x] `wrangler d1 create cubric-bench`, id into `wrangler.jsonc`, apply `schema.sql` remote, `wrangler secret
  put SALT` (random, never printed), `wrangler deploy` to `*.workers.dev`.
- [x] Smoke from Node `fetch` (the app's client, NOT Git Bash curl): POST a record for model `smoke-test`,
  GET scores, GET `/`; then DELETE the smoke rows (`wrangler d1 execute`). A 403 = the zone's bot protection:
  stop and brief Fabio.
- [x] **Fabio's yes** -> attach custom domain `bench.cubric.studio` to the Worker; re-run the smoke on it.
  **Verify:** all three answers from the custom domain; D1 holds no smoke rows.

## Phase 3: live check + publish (verify mode user-ux)

- [ ] Fabio restarts on the app batch, ticks Share, benchmarks a LOCAL Ollama model (free): end line and toast
  say shared; bench.cubric.studio lists the run; he judges the copy and the page.
- [ ] **Fabio's yes** -> push the privacy commit (a push is the deploy); check https://cubric.studio/privacy/
  shows the new entries.
  **Verify:** Fabio's OK on the live run, the page and the copy; the privacy page live.

## Plan Drift

- 2026-09-29 10:50, Fabio: the GPU is busy with his generations, so the Ollama benchmark runs (the live
  shared run + the four scores to stamp) move to the LAST step, whenever the card is free. Before that, with no
  GPU: his copy look, the privacy push, and committing the Worker (mpi-ci) and the app (Vision). The live
  page's lede now lists everything a run sends (app version and seconds per test were missing; redeployed).

- 2026-09-29 batch: `perChat` cap 1 -> 10 USD (an Opus-class chat can pass $1; the Worker would 400 its
  share). A `vramGb` of 0 = unknown to the app (Mac, AMD, no nvidia-smi): the page shows the GPU name alone.
- The clean-run regex spares `agent:error STEP_LIMIT:` (the model looping to the loop's cap is ITS score,
  not a connection failure): `/^(?:agent:error (?!STEP_LIMIT:)|crashed:)/`. Any one errored case marks the
  whole run errored (neither shared nor kept).
- Worker test script is `node --test "test/*.test.mjs"` (Node 24 reads `test/` as a module). SALT is put
  AFTER the first deploy (the Worker must exist); POST fails closed with 500 until then. A 400/413 also
  spends one of the IP's 10 daily POSTs. The page shows models with 1-2 runs faded ("not enough runs yet"),
  at most 3 suites, 2000 rows a suite. `observability.enabled: false` explicit (the privacy page promises no
  IP logging).

## Verification

**Verify mode:** user-ux (Phase 3 only; the batch and Phase 2 self-verify).

End to end: a shared run appears on the public page; with >= 3 real runs a model shows "(community, N runs)"
on the agent row of a user who has neither their own nor our score; stopped or errored runs are neither shared
nor kept; offline, the Remote panel behaves exactly as before; the privacy page is true.

## Preservation Notes

- Close-out: ask about `.claude/rules/` (new Storage key, bench:done fields, the checkbox mount);
  `docs/llm.md` budget; `MadPony-Identity/capabilities/` may want a `cloudflare-workers` note beside the R2 one.
- MPI-941's errored-run keep hole is fixed HERE (same system), not reopened there.
