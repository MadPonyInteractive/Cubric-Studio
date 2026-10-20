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
