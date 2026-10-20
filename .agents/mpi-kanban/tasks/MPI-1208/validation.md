# MPI-1208 validation

## Half 2 - tool facts (2026-10-19)

What changed, all facts at pick time, no route rule:
- `modelPriority.js` OP_NOTES: one note on every edit op (`edit`, `kleinEdit`, `krea2Edit`, `qwenEdit`):
  what it changes, that it keeps the first picture's shape unless it lists ratios, later pictures are sources.
  i2i note: at a denoise that keeps the person, pose, layout and clothes stay.
- NOTES: Qwen-Image 2.1 edit opens "the best editor here"; Boogu "the strongest editor here" -> "a strong
  editor"; Klein 9B "the native editor" -> "edits in place"; Klein 4B "small native" -> "smaller Klein editor".
  Both words outranked rank 1 in the live run. EDIT order untouched.
- crop note: "It changes the shape only: what is left is untouched."
- Outpaint description's first sentence (its agent `does`, and the Flow Library card): "Extend an image past its
  edges into a new shape, the new area painted from what you describe."
- OP_RULES `shape`: "a ratio here only crops the picture before the run ... changes nothing else"; no longer
  fires on edit ops (FLUX.3 Klein's edit ratio re-composes a new frame, not a crop - Flux.3 integration 5).
- System prompt Plan rule (+248 bytes, budget 12,074 -> 12,322).
- Bench case `shape-then-edit` (services/agentBench.mjs): crop or Outpaint before an edit, no i2i; flip keeps it square.

Evidence:
- `node --test tests/agent-*.test.cjs tests/flow*.test.cjs tests/model-priority.test.cjs tests/connector*.test.cjs`:
  924 tests, 923 pass, 0 fail (1 skipped).
- `node --test tests/agent-loop.test.cjs`: 196 pass, 0 fail.
- New case's check exercised on synthetic runs (crop+edit and outpaint+edit pass; i2i, edit-before-crop,
  edit-only fail).
- NOT run: the live bench case against a model. It bills DeepInfra; waits for Fabio's yes with the Half 1 runs.
- CI: run 39332677834 (Tests) green on 3020e6307.

## Half 1 - vision wiring (2026-10-19/20, Cosmo improvements 2)

Fabio: description stays the default, Cosmo sees only on request, tokens are the concern; text-only
models stay as the cheaper option; chat label is a gag on Prism.

Built (uncommitted at handoff): `look` `see: true` (vision models only, `_visionFor`), 768 px JPEG
as one user message after the round's tool results, gone next turn, `SEE_LIMITS` on plain looks for
vision models, unreadable picture -> description, `messageChars` counts a picture as 2,000 chars.
`scripts/agent-test.mjs --vision` (3 CLI-only cases) + seen/billed in its output.
Pictures: `media-for-testing/agent-bench/` (gitignored), made by
`node <scratch>/make-bench-pics.cjs` from test_ce77a5fb edit_002 / edit_005 / i2i_002 (+ gaussian
noise sigma 60, overlay). Re-make if missing.

Evidence:
- `node --test tests/agent-loop.test.cjs`: 203 pass, 0 fail (7 new in block (v)).
- agent-prompt-budget 7/7, agent-bench 17/17, agent-tiles 8/8, model-priority 16/16.
- Live: DeepInfra accepts the picture message (Ling and DeepSeek-V4.1 both named details only
  the pixels carry). DeepSeek-V4-Flash-0731 is `vision: false` in the catalogue, V4.1 and Ling `true`.

Bench step 1 (one run each, `research/bench/`):
- DeepSeek-V4.1-Flash: suite 41/53; vision 2/3 (identity FAIL: saw both, said "Same woman").
  Ceiling $0.7814, **billed $0.0854** (cache!); vision ceiling $0.0286, billed $0.0033.
  Fails: picks-installed-model (invented "flux2"/"text_to_image"), install-needed, ask-first,
  video-limit, several-subjects-reference-whole, look-grade-into-prompt, 4x video-edit routing,
  sheet-from-body-picture, options-ideas.
- Ling-3.0-flash-VL: INCOMPLETE at handoff, 16/53 done, 2 fail (look-refusal, video-limit); its
  --vision run had not started. Rerun if the file has no summary.
- Probe runs before step 1: ceiling $0.0026, billed $0.0014.
- **Spent so far: billed ~$0.09 (ceiling ~$0.82) of Fabio's $2.75.**
- Identity drift fails on BOTH models after seeing: a perception limit, not wiring.

## Bench step 1 + 2 done (2026-10-20, Cosmo improvements 3)

- Ling-3.0-flash-VL (rerun, 1 run): suite 40/53, vision 2/3 (identity FAIL: saw both, "same character").
  Ceiling $0.3889, **billed $0.1625** ($0.0030/chat): twice DeepSeek's bill at a third of its list price.
- Winner DeepSeek-V4.1-Flash, 3 runs (pass = 3/3): suite 34/53 (+ install-asks 3/3 on rerun after a
  429 = 35/53), vision 2/3 cases 3/3 + identity 2/3. Ceiling $2.2071, **billed $0.2436** for 168 chats
  ($0.00145/chat). 0/3: video-limit, several-subjects-reference-whole, video-hair-to-video-edit,
  video-buns-keeps-face, video-person-from-picture, sheet-from-body-picture.
- New cases 3/3 on DeepSeek-V4.1: max-resolution-is-top-tier (Krea 2 -> 2k), max-resolution-video
  (H3 -> 4k), both flips bite. Unit: agent-bench 17/17, agent-loop/model-priority/budget/tiles 251 pass.
- **Spent, billed: ~$0.53 of $2.75** (the ceiling sum is ~$3.6, over the cap on paper; the ceiling prices cached tokens as fresh). Files: research/bench/*.txt.
- Baseline gap: today's default DeepSeek-V4-Flash-0731 was never run on the 53-case suite (33/34 was
  the old suite), so V4.1 vs the default is unmeasured. Needs Fabio's yes (new spend).

## Baseline: today's default (2026-10-20, Fabio's yes up to $0.65)

- DeepSeek-V4-Flash-0731, 3 runs, 55 cases: **48/55 at 3/3**, billed **$0.2678** ($0.00162/chat),
  ceiling $0.7012. Misses: options-ideas 0/3, sheet-from-face-picture 1/3, shape-then-edit 1/3 (both
  misses = DeepInfra 180 s timeouts, not a wrong route), new-project-brief / check-in-holds /
  check-in-only / memory-write-unprompted 2/3. max-resolution image + video 3/3.
- vs DeepSeek-V4.1-Flash 37/55 (35/53 + 2 new) at $0.00145/chat: the default plans far better at the
  same bill. V4.1 only adds sight, and sight did not settle identity (2/3).
- Total spent, billed: ~$0.80 ($0.53 before + $0.27 baseline).

## Ratings stored (2026-10-20, Cosmo improvements 4)

- App: `services/llmEngines.mjs` agentTest = median of runs: 0731 52/55 x3, V4.1 44/55 x3, Ling 40/53 x1
  (hash 171f63b8829f, "older tests"); perChat billed. node --test llm-connection, llm-service, agent-loop,
  agent-bench, bench-community, llm-describe: 276 pass, 0 fail.
- Website (Fabio's yes): 6 runs POSTed to bench.cubric.studio, each `{ ok: true }`; `GET /` lists
  0731 52/55 counted, V4.1 44/55 counted, suite e4f83ddc0bfe.
- Screening (Fabio's yes, est. $0.62, cap $1.25): MiMo-V2.6-Flash, V4.1-Flash-1017, Nemotron-3.5-Super-VL,
  GLM-5.3-Flash, 1 run suite + vision each, files research/bench/<model>-{suite,vision}-1run.txt.
  Results (suite /55, vision /3, billed for 58 chats, $/chat suite):
  - MiMo-V2.6-Flash: 53/55, 2/3 (identity fail), $0.0851, $0.0015/chat. Misses video-buns-keeps-face, sheet-from-words.
  - DeepSeek-V4.1-Flash-1017: 51/55, 3/3 (FIRST identity pass), $0.0649, $0.0011/chat. Misses: video-limit + 3 video-edit routes.
  - Nemotron-3.5-Super-VL: 51/55, 2/3, $0.3999, $0.0071/chat (2.3x estimate); never chose to see a picture.
  - GLM-5.3-Flash: INVALID, 22/55 with 34 cases = DeepInfra 429 Too Many Requests; vision 3/3; $0.1373.
  Screen spent $0.687 of the $1.25 cap. Total MPI-1208 billed ~$1.49.

## 3-run pass (2026-10-20, Fabio's yes, est. $0.46; GLM retry skipped by his pick)

- MiMo-V2.6-Flash: runs 51, 53, 53 = **53/55 median** (49 strict), billed $0.1947 / 165 = $0.0012/chat, 21 s/test.
  Vision: identity 2/3, grain 2/3, see-not-for-a-plain-description 0/3 (always spends a picture). 0 x 429.
- DeepSeek-V4.1-Flash-1017: runs 48, 49, 47 = **48/55** (43 strict), $0.1834 / 165 = $0.0011/chat, 16 s/test.
  Vision: identity 1/3, grain 3/3, plain-description 3/3. Misses: video routing, camera-angle/two-subject refs.
- vs default 0731 52/55 (48 strict) $0.0016/chat: MiMo beats it on score AND bill (suite only).
- Spent $0.391. Card total billed ~$1.88. Both added to `llmEngines.mjs` (jobs: []); 32 tests pass.
  Upload (Fabio's yes): MiMo 3 runs `{ok:true}`; 1017 run 1 ok, runs 2-3 hit the 10/day limit, then sent with
  the MPI-1211 owner key (201). Site: MiMo 53/55, 1017 48/55, both counted.

## MiMo see-on-every-look fix (2026-10-20, Fabio's yes, est. $0.20)

- Cause: the `limits` note on every plain look (vision models) ended "see: true shows you the picture." -> an
  invitation. SEE_LIMITS reworded: words are enough to say what a picture shows; see only for faces, grain, colour.
  agent-loop + prompt-budget + agent-bench: 227 pass.
- MiMo after: vision identity 2/3, grain 3/3 (was 2/3), plain-description **3/3 (was 0/3)**, billed $0.0070.
  Suite x3: runs 53, 50, 52 = 52/55 median (47 strict), billed $0.1970 ($0.0012/chat), 0 x 429. Misses scattered
  (shape-then-edit 1/3, video-buns 1/3, options markers 2/3). Six MiMo runs: 51 53 53 53 50 52.
- = ties the default 0731 (52/55, $0.0016) at 25% less, and sees when it must. Card total billed ~$2.09.
