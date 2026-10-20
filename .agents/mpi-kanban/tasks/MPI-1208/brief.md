# MPI-1208 — Cosmo sees the pictures, and plans from what each tool can change

Fabio, 2026-10-19: "Cosmo needs to be intelligent enough to figure things out by himself. We can't
keep giving him straight, direct instructions. ... Cosmo's job is to know what tools he has at his
disposal and be intelligent enough to choose what needs to happen." And: "I think Cosmo gets very
confused sometimes because he's not seeing the images, only getting a description of the images."

Current release 2.1.1; this targets 2.1.2 or later (Fabio's call on the cut).

## The live case that started it

Project `C:\Users\Fabio\Documents\Cubric Studio\Projects\test_ce77a5fb` (sidecars in
`Media/.meta/`), log `%APPDATA%\Cubric Studio\logs\app-20261019-213018.log` from line 1981 (22:27-22:31
local). A 1:1 picture (edit_002) and the ask "9:16, solo, smiling, hands on hips, mini skirt and
fishnets". Five runs, all Klein 9B, each on ONE picture:

| Card | Op | Input |
|---|---|---|
| i2i_001 | klein-9b i2i 9:16, denoise 0.5 | edit_002 |
| i2i_002 | klein-9b i2i 9:16, denoise 0.6 | edit_002 |
| edit_004 | klein-9b kleinEdit | i2i_002 |
| i2i_003 | klein-9b i2i 9:16, denoise 0.55 | edit_002 |
| edit_005 | klein-9b kleinEdit | i2i_003 |

- The 9:16 sent a pose/outfit change to i2i: no editor takes a ratio, and OP_RULES `shape`
  (`services/agentLoop.mjs` ~429), which fires on i2i, reads "a generation from a picture crops it to
  the ratio", as if i2i were how you change shape. The pose never moved at 0.5-0.6.
- The edit task's rank 1 (Qwen-Image 2.1, MPI-1202) was passed over for "the native editor" (kleinEdit's note).
- Fabio asked for a TWO-picture edit ("pick up the original image ... replace the current girl with
  the woman in the original"). Cosmo restarted from the original alone. No run ever got two pictures.
- Cosmo said "built from the original's identity ... matches what you asked for" while face,
  proportions and clothes had drifted: a describer gives "purple-haired woman" for both, so a
  text-only model cannot judge identity.

Fabio's correct routes (for a bench case ONLY, never prompt text): crop to 9:16, then ONE edit that
pulls her back, changes the pose and adds skirt + fishnets; or outpaint the bottom to 9:16 with the
skirt and fishnets in the outpaint prompt (`positive`, "What goes in the new area?"), then edit the
pose and expression. Out of scope: Flux 3's coming box edit that reshapes in one pass.

## Half 1 — a chat model that sees the pictures

Today the agent model is `deepseek-ai/DeepSeek-V4-Flash-0731` (text-only, 33/34 on the agent suite,
$0.0035/chat; `RECOMMENDED_REMOTE_MODELS`). `look` goes to a separate describer and returns TEXT
(`docs/agent-chat.md` row 8). Pulled from MPI-1134 Phase 5b "Vision chat model", which also names
the MPI-1164 look leak (grain copied onto a light ask, 6/6 on DeepSeek; restore the "only that quality"
assertion removed in e5f4f9a00).

1. Wiring: when the agent profile's model has `vision` (`/llm/connection/models` already reports it),
   `look` hands the picture itself to the chat model as an image part of the tool result (fallback:
   the describer text, unchanged for text-only models). Mind the cost: an image every turn breaks
   nothing but the prompt cache's prefix stability (see `~/.claude/memory/tools/deepinfra.md` — the
   cache is a prefix cache), so images ride in tool results, never in the system prompt.
2. Candidates: DeepInfra models tagged vision + tools (list them from the keyless catalogue first;
   MPI-1134 lists Ling-3.0-flash-VL, Nemotron-3.5-Super-VL, MiMo-V2.6-Flash for video). Qwen3-VL-30B
   scored 7/22 on the suite in 2026-09 and lost its agent flag: the suite decides, not the label.
3. Bench: run `scripts/agent-test.mjs` per candidate. **It bills DeepInfra: state the price per run
   and the number of runs, and get Fabio's yes first.** Add cases a describer cannot pass: "is this
   the same woman as picture 1?", the grain-only case.

## Half 2 — tool facts at pick time (no recipes)

State each op's CAPABILITY where the agent picks it, as a fact, never a route:
- an edit op keeps its first picture's shape, changes content/pose/clothes, takes further pictures as sources;
- i2i repaints from words and keeps pose and layout at the denoise that keeps the person;
- crop (`js/shell/agentToolOps.js`) changes the shape only;
- Outpaint (`js/data/flowsRegistry.js`) changes the shape and fills the new area from its prompt.
Home: OP_NOTES for the edit task's ops in `js/data/modelConstants/modelPriority.js`, the crop note,
Outpaint's `does`; reword OP_RULES `shape` so it cannot read as "i2i changes shape". Plus ONE planning
line in the system prompt: before the first run of a multi-part ask, list what must change (shape,
content, pose, identity, style) and give each to the tool that changes it, in an order where no step
undoes an earlier one. Qwen-Image 2.1's edit note should say why it is rank 1 before the licence line.
Do NOT reorder EDIT (Fabio, MPI-1202).

**Peer:** MPI-1181 (FLUX.3 Klein) holds a live claim on `modelPriority.js` and is adding `flux3-klein`.
Coordinate before editing it.

## Done

- Half 2 in, `tests/model-priority`, `agent-prompt-budget` (raise only by the words' cost),
  `agent-loop`, `agent-tiles`, `agent-bench` green; a bench case for the 9:16 job (crop or outpaint
  before an edit, no i2i).
- Half 1: vision wiring behind the model's `vision` flag with tests; bench evidence per candidate in
  `research/`; a recommendation to Fabio with score and cost per chat. The default model changes only on his yes.
- A finding in `docs/agent-findings.md` (200-line cap).
- Code commits with the card in `doing`; done only on a green CI run (done-gate).

## Current State (2026-10-20 evening, end of Cosmo improvements 4)

- SHIPPED a836a4334 (code) + 6580548bb (card), pushed: MiMo-V2.6-Flash is Cosmo's default (52/55 median,
  $0.0012/chat, sees pictures); SEE_LIMITS reworded; FLUX.3 fixes from Flux.3 integration 11 (qualityTier enum
  dropped, source-ratio snap skips Custom size edits via namedParamsFor `customSize: true`, test in agent-loop).
  bench.cubric.studio: MiMo #1 52/55 over 6 runs; uploads beyond 10/day use the MPI-1211 owner key
  (`C:/Users/Fabio/.secrets/bench-owner.txt`, header `X-Owner-Key`). CI run 39477999801 was in progress.
- NEXT (Fabio's yes, FREE): MiniMax M3.1 Flash via Ollama Cloud, `minimax-m3.1-flash:cloud`, free until
  2026-10-22 23:59 UTC, then $0.15 / $0.015 / $0.60 per 1M (~$0.0035/chat est). Fabio's Ollama is signed in,
  plan free; a probe tool call worked. Start `ollama serve` in the background if
  `http://127.0.0.1:11434/api/version` does not answer. Run sequentially:
  `node scripts/agent-test.mjs --runs 1 --preset ollama --model minimax-m3.1-flash:cloud > research/bench/minimax-m3.1-flash-cloud-suite-1run.txt 2>&1`
  then the same with `--vision` (> ...-vision-1run.txt). Free-plan usage limits may cut the run: count errored
  cases as invalid, not fails. 3-run only if it screens clearly above MiMo, and before the free window ends.
  Upload to the site only for >= 3 runs (preset `ollama`, no GPU for a cloud model).

## Current State (2026-10-20, Cosmo improvements 4)

- Ratings: the app's are in `services/llmEngines.mjs` `RECOMMENDED_REMOTE_MODELS.deepinfra[].agentTest`
  (MEDIAN of runs, suiteHash, perChat). Updated, uncommitted: 0731 52/55 x3 (48 strict), V4.1 44/55 x3
  (37 strict), Ling 40/53 x1 (older-tests hash 171f63b8829f); perChat now BILLED. Current suite hash
  e4f83ddc0bfe. Tests: llm-connection/llm-service/agent-loop/agent-bench/bench-community/llm-describe pass.
- Website = bench.cubric.studio (Worker `mpi-ci/cubric-bench`, D1), filled only by app uploads (`POST /v1/runs`,
  10/day, shows >= 3 runs). Today it shows only 0731 33/34 on the old suite. Upload of the 6 runs (0731 x3,
  V4.1 x3) is ready as a dry run (scratchpad `share-bench.mjs`, `--post` to send): PUBLIC, waits on Fabio's yes.
  Ling not uploaded (1 run, no matching hash).
- Shortlist: `research/shortlist-2026-10-20.md`. Fabio said yes to the upload and the screen; both done.
  Screen (1 run): MiMo-V2.6-Flash 53/55 $0.0015/chat; V4.1-Flash-1017 51/55 $0.0011/chat + identity PASS;
  Nemotron 51/55 but $0.0071/chat; GLM invalid (34 cases 429). Spent $0.69 (total ~$1.49). Results: validation.md.
  3-run (his yes): MiMo-V2.6-Flash 53/55 median $0.0012/chat (beats 0731 52/55 $0.0016), but spends a
  picture on every look; V4.1-Flash-1017 48/55 $0.0011. Both in llmEngines.mjs, uncommitted. GLM retry skipped.
  Uploaded (1017's last 2 via the MPI-1211 owner key, closed). SEE_LIMITS reworded in agentLoop.mjs (MiMo saw on
  every look); MiMo rerun after it: 52/55, plain-description 3/3, $0.0012/chat; app row says 52. Uncommitted:
  llmEngines.mjs, agentLoop.mjs. Open for Fabio: MiMo as default; upload the post-fix MiMo runs.

## Current State (2026-10-20, Cosmo improvements 3)

- Bench done: winner DeepSeek-V4.1-Flash (3 runs: 35/53 suite, vision 2/3 + identity 2/3, billed
  $0.00145/chat); Ling lost on score AND bill. Finding written (docs/agent-findings.md, 200 lines).
  Spent ~$0.53 billed of $2.75. Details: validation.md.
- Uncommitted: EDIT_NOTE (custom size), OP_RULES tier (max = last tier), 3 bench cases, findings doc.
- Baseline run (Fabio's yes): default V4-Flash-0731 48/55 at 3/3, $0.0016/chat billed, vs V4.1 37/55.
  Fabio 2026-10-20: KEEP 0731 as default, change nothing in the app now, but test more. Spent ~$0.80.
- Next (Fabio): (1) update the stored agent ratings in the app and on the website with the three new
  results (0731 48/55, V4.1 37/55, Ling 40/53); Qwen3.6-35B's rating is from the 28-case suite.
  (2) Research which DeepInfra models could do well in our system (vision + tools, good cache rate),
  shortlist, then bench the shortlist (price per run first, his yes). Prices move with sales: V4.1
  is 30% off now ($0.14 in / $0.004 cached), MiMo-V2.6-Flash $0.133 / $0.003, GLM-5.3-Flash
  (multimodal) $0.075 / $0.015 at 50% off for a day, Nemotron-3.5-Super-VL $0.15 / $0.02.
  Grade on billed cost. (3) Decision models on DeepInfra (MPI-1040) - a separate card, later.

## Custom size on edit (2026-10-20, Cosmo improvements 3)

Fabio: every unmasked edit now takes an optional custom size (MPI-1207, 7fec15a81; FLUX.3 in
MPI-1181), so "no editor takes a ratio" above is no longer true. The agent path already works:
a named ratio on an edit op turns custom size on (`resolveNamedParams`). Half 2 facts updated,
uncommitted: `EDIT_NOTE` now says a ratio re-composes the picture to fill the new frame in the
same run (not cropped), on every edit op listing ratios (the FLUX.3-only copy removed);
bench `shape-then-edit` accepts ONE edit at a new ratio as well as crop/Outpaint first.
agent-bench, model-priority, agent-prompt-budget, agent-loop: 243 pass.
Fabio 2026-10-20: Cosmo turns the optional button on only when needed; off = the picture's own
size. Already true: unpinned, `resolveSettingsOwner` passes `project: null`, so an unasked edit
is custom-size OFF and a named ratio turns it on; pinned, the user's button decides. EDIT_NOTE
reworded to say "no ratio = own size, a ratio = new frame".

Resolution (Fabio 2026-10-20): unasked = 1K (the smallest tier), "max" = each model's own top
tier (Krea 2 = 2K, FLUX.3 Klein = 4K); models with no tiers have nothing to send. Already true
for the unasked default (`defaultQualityTier` = tiers[0] for image models; unpinned project is
null). Added: OP_RULES `tier` says tiers run smallest to largest, the last is the max, an unasked
picture leaves qualityTier out. Bench `max-resolution-is-top-tier` (Krea 2 -> "2k"): 1/1 live,
flip fails as it must. Its first 3-run attempt hit DeepInfra 429s (run beside the 3-run pass,
which lost `install-asks #1` to the same 429): rerun both SEQUENTIALLY after the pass.
Video too (Fabio): the `tier` rule fires on every op with tierSizes, clips included. Real lists:
LTX 2.3 and MiniMax H3 very_low..very_high, 2k, 4k (top 3840x2176); Wan 2.2 tops at very_high
1920x1088; Wan 2.2 5B high 1280x704; Seedance / Wan 3 cloud 1080p; Veo 1080p. Case
`max-resolution-video` (H3 -> "4k") added, not yet run live.

## Current State (2026-10-19, Cosmo improvements 2)

- **Half 1 wiring built, uncommitted** (Fabio's call this session: description stays the default,
  the model SEES only on request, tokens are the concern). `look` gains `see: true`, offered only
  when the model's catalogue row says `vision`; picture 768 px JPEG as ONE user message after the
  round's tool results; gone next turn (a line replaces it); plain looks on a vision model carry
  `limits` (Ling said "same woman" from words without it); chat label blames Prism (Fabio's gag).
  Text-only models unchanged = the cheaper option users keep. Doc row: `docs/agent-chat.md` look.
- Bench: `scripts/agent-test.mjs --vision` = 3 real-picture cases (CLI only: the shipped suite and
  its hash must not move), pictures in gitignored `media-for-testing/agent-bench/` from project
  test_ce77a5fb (`make-bench-pics` recipe in validation.md). Output now prints pictures seen + billed.
- First live probe: Ling SAW both pictures (named the zipped top) yet still said "same woman".
- Step 1: DeepSeek-V4.1-Flash 41/53 suite + 2/3 vision, billed $0.0854 (ceiling $0.78: the cache
  cuts the real bill ~9x). Ling was 16/53 at handoff (still running in session 2's background; rerun
  if its file has no summary, then `--vision` on Ling). Both models SAW the identity pair and still
  said "same woman": perception limit. Spent ~$0.09 billed of $2.75. Details: validation.md.
- Next: finish Ling, pick the winner, 3-run pass on it (price it first from billed, not ceiling),
  recommendation to Fabio, finding in docs/agent-findings.md (at 200 lines: merge to make room).

## Previous State (2026-10-19, Cosmo improvements 1)

- Half 2 shipped in 3020e6307, CI 39332677834 green. Card stays in `doing` for Half 1.
- Half 1 next: wire `look` to hand the picture itself to a chat model whose profile reports `vision`
  (describer text stays the fallback), with tests. Then make the bench send the picture too, or it
  measures the describer, not the model. Candidates + prices: `research/vision-candidates.md`.
- **Fabio approved the spend (2026-10-19): up to $2.75 worst case, two models only.** Step 1: every
  case once on `inclusionAI/Ling-3.0-flash-VL` and `deepseek-ai/DeepSeek-V4.1-Flash` (106 chats,
  ~$0.85 ceiling). Step 2: full 3-run pass on the winner only (~$0.55 Ling / ~$1.90 DeepSeek). His
  DeepInfra balance was $7.47. Nemotron / MiMo only if both fail, and that needs a new yes.
- The live `shape-then-edit` bench case has never run; it runs inside step 1.
