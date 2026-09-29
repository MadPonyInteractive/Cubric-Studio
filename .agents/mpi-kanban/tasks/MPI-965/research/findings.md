# MPI-965 investigation, 2026-09-29 (session 8d7c61a8, three read-only agents)

## App hooks (Cubric-Vision)
- `POST /agent/benchmark` `routes/agent.js:386-400` reads `{ profileId, model }` (387) -> `sessions.benchmark` (399).
  `AgentSessions._runBench` `services/agentSessions.mjs:175-209`: upload slots between `local` (195) and the
  `bench:done` broadcast (196); `bench.model` is the PROBED model (182), so the id is resolved even when blank.
- `runSuite` `services/agentBench.mjs:825-844` -> `{ results: [{ id, title, passed, failures[] }], passed, cases,
  costUsd, suiteHash, stopped }`. No per-case time: take `Date.now()` deltas in `onProgress`. **Never upload
  `failures`** (model-chosen text: paths, ids). **An errored run is not an error:** `runCase` (796-806) turns a
  crash / `agent:error` (402, rate limit) into a failure line, so a dead connection reads as a whole run of
  fails -- and MPI-941 KEEPS it locally today. Detect: `failures` matching `/^(agent:error|crashed:)/`.
- App version: `js/core/appVersion.js` `APP_VERSION` (ESM, importable). Local: `onLocalGpu` (agentLoop.mjs
  2935, already imported). GPU name: `resolveDownloadConfig()` `routes/platformEngine.js:319-358` (CJS,
  memoised; `createRequire` as agentBench.mjs:30). VRAM: `getVramStats()` `routes/system.js:24-32` NOT
  exported (router only, 414).
- Model list: `GET /llm/connection/models` `routes/llm.js:145-150` -> `_connectionModels` -> `listRemoteModels`
  (`llmEngines.mjs:582-618`, `agentTest` merged at 613). **Merge community in the GET route only**: probe
  (llm.js:133) and agentLoop.mjs:1599 also call `listRemoteModels`. Suite hash: see `benchmarkInfo`
  (agentSessions.mjs:228). Public-fetch precedent: `fetchDeepInfraPrices` (llmEngines.mjs:496-504, 3 s, null
  on failure). URL precedent: constant + env override (`CUBRIC_OPENAI_BASE_URL`, llmEngines.mjs:466-498).
  `trustSystemCa()` covers AV HTTPS scanning; no proxy handling anywhere.
- Renderer `MpiLlmSettings.js`: bench markup 203-211; `_renderBench` 904-939 (confirm 925-928); `_benchRun`
  955-964 posts the body (957); `scoreOf` 587, sort 588-593; `_currentTests` 991; `_agentTestLabel` 1000.
  MpiCheckbox `{ label, checked, disabled, variant }`, emits `change {checked}` (example MpiRunpodSettings.js
  1685-1692). External link: `openExternal(url)` `js/utils/openExternal.js`.
- Storage: `normalizeAgentPrefs` (storage.js:145-150) keeps ONLY `{ model, mode }` -> a share pref there is
  dropped; use its own key beside `AGENT_BENCH` (storageKeys.js:108).
- Profile ids beyond the five presets exist (`main/secretsStore.js:227-229`): allow-list the four, not deny custom.
- Tests: agent-bench stubs `DeepInfraEngine.prototype.chat`, global fetch is REAL (a share test must stub it);
  llm-connection `stubUpstream` catches every non-127.0.0.1 fetch and some tests assert exact URL / call count
  (82, 208) -> the community GET needs an env off-switch; desktop spec asserts the posted body (204-205).

## Hosting
- `cubric.studio` DNS zone is ON Cloudflare (MadPony-Identity/capabilities/cloudflare-r2/README.md 16-18); apex is
  GitHub Pages via a record in it; R2 domains dl./models./pod. No Worker, wrangler config or D1 anywhere; wrangler
  NOT installed, never logged in; no Cloudflare API token (the R2 token is objects-only). README 174-184: DNS /
  custom-domain changes need Fabio's explicit yes.
- `scripts/build-portable.mjs:113-152` is a DENYLIST: a new `workers/` in Vision would SHIP. Precedent for product
  server code in a sibling: `mpi-ci/cubric-vision-pod/` (private repo).
- Edge caveats: young-domain ISP filters (docs/download-manager.md 955-965) -> non-blocking fetch; the zone's bot
  protection 403'd urllib / Git Bash curl on models. (r2-hf-uploads.md 157) -> smoke the app's Node fetch early.

## Privacy page (Cubric Studio (Website)/privacy/index.html, GitHub Pages, push = deploy, push needs Fabio's yes)
- Entries: `<h3>Name (condition)</h3><p>when / what goes / what comes back / kept? / provider link</p>` under
  `<h2>When the app goes online</h2>` (L89); add two after L104. Bump "Last updated" (L67) + audit comment (L2-5).
- MORE lines go false: L11 meta + L69 "no telemetry"; L77 "only goes online to download things, or because you
  connected your own account" (the community GET is unasked); L120 "the only personal data we receive" (the Worker
  sees the IP: hashed with a daily salt, rate limit only, legitimate interests, Cloudflare host, US transfer per L128).
- Copy: the brief's hint "Only the scores, no prompts or keys" is UNTRUE (model, cost, app version, GPU also go);
  the current hint "nothing is generated or saved" (MpiLlmSettings.js:210) is untrue with sharing on.
- In-repo precedent: one privacy line in the feature doc (docs/dictation.md 47-48).
