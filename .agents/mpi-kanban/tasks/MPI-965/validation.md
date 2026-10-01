# MPI-965 validation

Verify mode: user-ux for Phase 3 only; the Parallel Batch and Phase 2 self-verify (plan.md § Verification).

## Evidence

- 2026-10-01 (session c524b7af) FABIO'S LIVE CHECK PASSED: his granite4.1:8b in-app share (14/34, RTX 4060 Ti)
  showed on bench.cubric.studio. Our DeepInfra runs re-scored on the 34-case suite (`38728db81118`, his yes,
  $0.64 of a $0.80 cap): DeepSeek-V4-Flash-0731 x3 = 30/34 strict (passes 33/32/33; 1-of-3 misses on ask-first,
  look-refusal, options-ideas, routine-in-capabilities), Qwen3.6-35B-A3B 31/34, gpt-oss-120b 31/34. Stamped into
  `RECOMMENDED_REMOTE_MODELS.deepinfra` (`node --test tests/llm-connection tests/bench-community
  tests/agent-bench` 43/43, eslint clean). The five runs were posted through `POST /v1/runs` with the app's own
  `buildRecord`, plus the 2026-09-25 22-case gemma4:12b and ornith:9b logs (MPI-912 research) under label
  `0c126f62b69a`, app 1.6.1. Worker (mpi-ci 77ae463, 0751542, 9a9deb3): lede says some runs are ours and drops
  the hard-coded 28; newer suites (by app version) replace a model's older runs, Ollama only on the same GPU;
  one table per provider with its most-failed tests underneath. Worker tests 46/46. Deploys are Fabio's.
- 2026-10-01 later: local re-runs on Fabio's RTX 4060 Ti under the GPU lease, `--preset ollama --runs 1`, 34 cases:
  ornith:9b 23/34 (was 16/26), gemma4:12b 18/34 (was 13/26); with his granite4.1:8b 14/34 all three stamped into
  `RECOMMENDED_REMOTE_MODELS.ollama` with the suite hash (granite newly listed, his yes). `tests/llm-connection`
  now reads ornith's stamp from the table instead of pinning the number. Both posted (10 of the day's 10).
  Worker redesign (mpi-ci 7e5ac7b, BenchLM-style ranked table in DESIGN.md mauve + Studio cream, time per test
  from `sec_per_case`) - FABIO'S LOOK PASSED ("I like the look ... we can push this"); deployed on his yes,
  version `5c814fe5`. Live page read back: 3 DeepInfra + 3 Ollama rows, all on 34 tests, the 22-test rows replaced.

- 2026-09-29 ~11:00 FABIO'S LOOK: in his own app (restarted on the batch code) Settings > Remote > Benchmark
  this model confirm step on DeepInfra (not run): tickbox, its hint, the bench hint and "See everyone's results"
  - "1. Yeah, it looks good" (screenshots in session 4a2a917e), plus the agent-model dropdown (scores + cost).
  He said yes to the privacy push; the push was refused to the agent as a production deploy, so Fabio runs
  `git -C "C:\AI\Mpi\Cubric Studio (Website)" push origin main` himself (commit `0df6b76`). Worker committed and
  pushed to mpi-ci `ba4c5b3` (both workflows there are workflow_dispatch only). Live page lede redeployed
  (version `8384efec`) to list everything a run sends.

- 2026-09-29 PHASE 2 LIVE (Fabio logged wrangler in; his "go ahead" for the domain): D1 `cubric-bench`
  created (WEUR, id `1017e76b-af5c-43f6-8820-16b3cda857d2`), schema applied remote (2 tables), deployed,
  SALT put from `crypto.randomBytes(32)` piped (never printed). workers.dev smoke (`node scripts/smoke.mjs
  https://cubric-bench.cubric-bench.workers.dev`) 15/15. Custom domain `bench.cubric.studio` attached via
  `routes: [{ custom_domain: true }]` (wrangler then turned workers.dev OFF: one public URL). Domain smoke via
  1.1.1.1 DNS 14/15, the 1 "fail" = runs 6 not 3 because the workers.dev smoke's rows were in the same D1
  (expected, not a bug); no zone bot-protection 403 for Node fetch. Smoke rows + rate rows deleted: D1 now
  `runs 0, rate 0`. Virgin Media's resolver still caches the pre-creation NXDOMAIN (negative TTL, ~30 min);
  1.1.1.1 resolves it to Cloudflare. Cost: $0 (no paid prompt anywhere).

- 2026-09-29 A2 app (Vision, uncommitted, 17 files): worker went RED first (20 new tests failing on the
  missing module/fields), then green. Orchestrator re-ran: `node --test tests/agent-bench.test.cjs
  tests/llm-connection.test.cjs tests/bench-community.test.cjs` 38/38; desktop spec
  `llm-settings-remote.spec.js` 2/2 (checkbox hidden for Custom, remembered, body carries `share`,
  "(community, 3 runs)" label + ranking, link -> openExternal, errored run not kept); `npm test` 2247 tests,
  2245 pass, 0 fail, 2 skipped; eslint `--max-warnings=0` on every touched file clean; `docs/llm.md` 200 lines.
- 2026-09-29 END TO END (orchestrator, `scratchpad/e2e965.mjs`): A2's real `services/benchCommunity.mjs`
  against A1's real Worker (`wrangler dev --local :8799`, fresh D1): 11/11 PASS - the record carries no
  `failures` text; 3 hosted shares 201; an Ollama share with this PC's GPU (`RTX 4060 Ti`, 16 GB) 201;
  perChat 2.5 accepted (after the cap fix); a `custom` preset refused 400 with the reason surfaced;
  `communityScores` = `{suite:"4891b5390518", models:[{deepinfra, Qwen/Qwen3.6-35B-A3B, runs 4, passed 22,
  cases 28, perChat 0.0051}]}`; the 1-run Ollama model left out; `withCommunity` merges by preset + exact
  id; the page lists both. Worker processes killed, port 8799 free, no workerd left.
- 2026-09-29 A1 Worker (`mpi-ci/cubric-bench/`, uncommitted, wrangler pinned 4.143.0): `npm test` 43/43
  (orchestrator re-ran: 43 pass 0 fail); worker's `wrangler dev --local :8799` + `node scripts/smoke.mjs
  http://127.0.0.1:8799 --full` 18/18 (201, 400, 413 both ways, 429 at the 11th, scores aggregate with
  Cache-Control, 1-run model hidden, 404s, page escapes a `<script>` id); `rate` held one 64-hex hash, no raw
  IP. Orchestrator re-checked: `.dev.vars`/`.wrangler/`/`node_modules/` git-ignored, `observability.enabled:
  false`, CF-Connecting-IP read only in the POST rate hash, nothing listening on 8799. Deviations: test script
  is `node --test "test/*.test.mjs"` (Node 24 reads `test/` as a module); SALT is put after the first deploy
  (POST fails closed with 500 until then); a 400/413 also spends one of the day's 10 POSTs. Not verified:
  Cache API on `*.workers.dev` (docs promise it on custom domains only).
- 2026-09-29 A3 privacy draft: Website repo local commit `0df6b76` "feat(privacy): agent benchmark sharing
  and community scores (MPI-965)", 1 file +14/-7; `git status -sb` = `ahead 1` (NOT pushed, orchestrator
  re-checked); 0 new em dashes (`git show HEAD | grep '^+' | grep -c '—'` = 0); html.parser: 0 unclosed tags.
  Copy calls left for Fabio (Phase 3): "no tracking" dropped from the meta description; "This needs no tick
  box" on the daily scores request. The page promises no IP logging: A1 told to keep Workers observability
  OFF and never read CF-Connecting-IP outside the POST rate hash.
