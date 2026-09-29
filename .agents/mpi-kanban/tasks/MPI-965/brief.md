# MPI-965 - Community agent benchmark: brief

Approved design, brainstorm with Fabio 2026-09-29 (session 8d7c61a8), right after MPI-941 closed.

**Why (Fabio):** new models come out every day; users' "Benchmark this model" runs save us testing
them all, and the community feels involved. Built properly it needs no maintenance.

## Decisions

1. **Scope C:** users share -> the app shows community scores -> a public leaderboard page. No upkeep.
2. **The page lives on the service itself** (`bench.cubric.studio`), not on the website: the site is
   due a full revamp and must not be touched until then; the revamp only links to it.
3. **Sharing = a tickbox in the confirm step** ("Share the result anonymously"), unticked the first
   time, remembered after. Hidden for the Custom provider. Stopped or errored runs are never shared.
4. **One number per model on the agent row:** your run > ours (current tests) > community (>= 3 runs,
   median), labelled `(community, 9 runs)`. Community-only models join the scored group on top.
5. **Keyed by provider preset + exact model id** (Ollama `qwen3.6:35b` and DeepInfra
   `Qwen/Qwen3.6-35B-A3B` score apart): no mapping table, no mixing quantisations. (Agent's call.)

## Service (Cloudflare Worker + D1, Fabio's account, free tier)

- `POST` a record: preset (deepinfra/openrouter/openai/ollama, never custom, never a URL), model id,
  suiteHash, per-case pass/fail by case id, cases, perChat, app version; local models add GPU name,
  VRAM, seconds a test. Never prompts, replies, keys, projects, paths or a user id. Server checks the
  shape, computes passed itself, 10 a day per IP (IP hashed with a daily salt, never stored raw).
- `GET` scores for a suiteHash: per (preset, model) runs, median passed, median perChat; >= 3 runs only.
- `GET /`: the public page, rendered from D1 per request: newest suite first, a table per provider
  (model, runs, median score, cost, GPUs for local), the tests that fail most across models.

## App

- Run posts `share` with the benchmark; the SERVER (agentSessions) uploads on a whole run, so it goes
  even with Settings shut. End line / toast: "· shared" or "· not shared: <why>". No retry queue.
- Community scores are fetched only when the Remote panel builds the agent list, cached 24 h
  server-side, merged into the connection model list; offline or down = today's rows, nothing waits.
- A "See everyone's results" link under the benchmark hint.
- Out: accounts, deleting shares (anonymous), speed ranking in-app.

## Order and constraints

Service live first (Cloudflare set up WITH Fabio), then the app, then `cubric.studio/privacy` in the
same job (it lists every outbound service; the daily GET and the upload make it false otherwise). The
app must not ship with the tickbox before the service exists.

## Noticed

- 2026-09-29 (A1): a POST flood from many IPs spends the D1 free-plan daily write quota (every POST upserts a
  `rate` row), after which real shares fail with 500 until the quota resets. Not a launch blocker at our
  volume; the answer if it happens is a Cloudflare rate-limiting rule in front of `/v1/runs`.
- 2026-09-29 (A2): `docs/agent-chat.md` is 562 lines, far over the 200-line doc cap, before and after this
  card (pre-existing; a split is its own job).
- 2026-09-29 (A2): the agent-model note ("ours or your own benchmark") does not mention the community tier;
  copy for Fabio's Phase 3 look.
- 2026-09-29 (A2): a preset profile id could in principle carry a URL override via `secretsStore`; the UI
  only allows that for Custom, so the share allow-list by profile id is not guarded against it.
