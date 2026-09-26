# MPI-916 Validation

## 1. Baseline (2026-09-25, before any change)

`agent-test --runs 3` on the four cases; logs `research/base-<model>.log` (gitignored).

| model | ranked-editor | rerun | sheet | head | runs passed | cost |
|---|---|---|---|---|---|---|
| deepseek-ai/DeepSeek-V4-Flash-0731 (pick) | 3/3 | 2/3 | 3/3 | 3/3 | 11/12 | $0.066 |
| Qwen/Qwen3.6-35B-A3B | 2/3 | 0/3 | 0/3 | 0/3 | 2/12 | $0.110 |
| openai/gpt-oss-120b | 1/3 | 0/3 | 0/3 | 0/3 | 1/12 | $0.036 |

Failure shapes: rerun = i2i with the picture as media (all three models); sheet = i2v_ms with
the sheet as startFrame (also t2i, or no generate); head = never measured a box, the model
asked mask-or-whole-picture or said it cannot swap heads, before any tool call; ranked-editor
= crossed to krea2 i2i for "make it night", or gpt-oss never re-sent generate after a
GUIDE_NOT_READ refusal.

## 2. fix1: `best` flag, ref2v/i2v/i2i notes, Route rule yields to a Flow

Same four cases x3; logs `research/fix1-<model>.log`.

| model | ranked-editor | rerun | sheet | head | runs passed | vs baseline |
|---|---|---|---|---|---|---|
| DeepSeek-V4-Flash-0731 (pick) | 3/3 | 3/3 | 3/3 | 3/3 | 12/12 | +1 |
| openai/gpt-oss-120b | 0/3 | 2/3 | 3/3 | 0/3 | 5/12 | +4 |
| Qwen/Qwen3.6-35B-A3B | - | - | - | - | no result | DeepInfra 429 / 180 s timeouts on every run; a raw `curl` got no HTTP answer in 60 s. Endpoint capacity, not the model |

gpt-oss: turn 0 of ranked-editor now takes kleinEdit 3/3 (`best`); turn 1 ("that edit again with
Krea 2") crossed to krea2 **i2i**, or read the guide after GUIDE_NOT_READ and stopped. Head:
still asks mask-or-whole-picture with no tool call.

## 2b. fix2: Route rule "answer this yourself", GUIDE_NOT_READ names the retry, compact ops show `task`

gpt-oss-120b x3 (`research/fix2-openai_gpt-oss-120b.log`): ranked-editor 1/3, rerun 2/3, sheet
3/3, head 0/3 = **7/12** on the four (fix1 5/12, baseline 1/12); adult-request 1/3.
- ranked-editor turn 1 still ran krea2 **i2i**. Cause found in our own guide: `guide:krea-2`
  (read before every Krea 2 generate) called krea2Edit "the third choice ... reach for it when
  those are not installed" and sent "an existing image reshaped toward a new description" to
  i2i. Fixed in fix3: the ranking caveat is for when the agent picks the editor; an edit asked
  for ON Krea 2 is krea2Edit.
- head: no tool call; "run a whole-picture head-swap flow" offered as route 2 of 2. The Route
  rule's own "one area: give both routes" outweighed its first sentence. fix3 moves Head Swap
  into the Model rule's task list and scopes the Route rule to edits.

## 2c. fix3: Krea 2 guide fixed, Head Swap in the Model rule, Route rule scoped to edits

x3, `research/fix3-*.log`. Pick: ranked-editor 3/3, head 3/3. gpt-oss-120b: ranked-editor 1/3,
head 0/3, but both failure shapes changed:
- ranked-editor turn 1 now picks **krea2Edit** (right op), is refused GUIDE_NOT_READ, reads the
  guide, says "Generating the night-scene edit with Krea 2" and ends the turn. Nothing sent.
- head now runs the Head Swap **Flow** (list_models, describe_model, generate) instead of asking
  about masks, but with NO box params, and the box gate only checked params that were sent, so
  the swap went through on the graph's baked default boxes (`headSwapInjector.js`: "no box ->
  leave the node's baked default"). A gate hole, not model weakness.

fix4: the box gate refuses a box Flow sent with none of its boxes (naming the first); a partial
set stays allowed, as the injector keeps each box optional. `read_knowledge` of the id a refused
generate waited on carries `next: "The generate that waited on this has NOT run. Send it again
now"`. Unit: 185/185 across the agent test files.

fix4, gpt-oss-120b x3 (`research/fix4-openai_gpt-oss-120b.log`): ranked-editor 2/3, rerun 3/3,
head 3/3; with sheet 3/3 from fix2 that is **11/12 on the four, from 1/12**. The one miss: turn 1
ran krea2 i2i before reading the guide and kept it after. Residual, left.

Probe trap met on the way: Git Bash `curl` reported every DeepInfra model `HTTP 000` (exit 43)
while Node `fetch` got `200` from all of them; the harness's own 429s on Qwen3.6 were real and
cleared about 30 minutes later.

## 2d. Final: the pick, full suite x3 (`research/final-deepseek-ai_DeepSeek-V4-Flash-0731.log`)

`agent-test --runs 3`, all fixes except the Content rule (it landed while this ran): 20 of the
original 22 cases 3/3, all four target cases 3/3; `ask-first` 2/3 (reply asked "say the word if
you'd rather have 9:16", the check wants a literal `?`), `look-refusal` 2/3 (named the
"built-in describer", the check wants "local"). Recheck `--runs 5` on both
(`research/recheck-pick-askfirst-lookrefusal.log`): **5/5 and 5/5**. So 7/8 each over 8 runs,
phrasing, on paths no fix touched. `adult-request` here predates the rule (1/3); after it, 3/3
(section 3). $0.215 for 69 conversations, $0.0031 each (the survey's $0.0033).

## 2e. Re-screen, full suite x1 (`research/final-*.log`), vs the MPI-912 survey

On the original 22 cases (adult separately: these runs predate the rule and the -nsfw check).
Cost = this run's suite, 23 conversations.

| model | now /22 | survey /22 | adult pre-rule | adult post-rule | suite cost | still failing |
|---|---|---|---|---|---|---|
| DeepSeek-V4-Flash-0731 (pick) | 22 (x8 on two flaky cases, section 2d) | 21 | fail | 3/3 | $0.072 | - |
| Qwen/Qwen3.6-35B-A3B | 21 | 18 | fail | pass | $0.156 (2.2x) | install-asks (fixed after, 3/3) |
| openai/gpt-oss-120b | 18 | 14 | fail | pass | $0.043 | create-then-generate, ranked-editor, rerun, no-delete |
| google/gemma-4-26B-A4B-it | 17 | 14 | pass | pass | $0.071 | create-then-generate, reads-guide-first, memory-write, ranked-editor, rerun, outpaint |
| nvidia/Nemotron-3-Nano-30B-A3B | 13 | 10 | pass | complied on klein-9b, not -nsfw | $0.105 | 10 cases |
| openai/gpt-oss-20b | 11 | 10 | fail | fail (no generate, empty reply) | $0.023 | 11 cases |
| Qwen/Qwen3-VL-30B-A3B-Instruct | 9 | 7 | **pass** | fail x2 ("I asked for 2 to 3 seconds.") | $0.300 (4.2x) | 14 cases incl. a `delete_project` call |

Every model gained 1-4 cases. Qwen3.6 lands closest to the pick but costs 2.2x per suite today
(its conversations ran longer than in the survey, $0.0068 vs $0.0061 each), so it is at the edge
of the 2x price rule. Qwen3-VL-30B was the only permissive one before the Content rule; with the
rule the pick, Qwen3.6, gpt-oss-120b and gemma comply, and Qwen3-VL no longer earns anything.

Post-screen fixes (install): `install_model` says "the card IS the question: call it, never ask in
words first"; an install No says the model is NOT installed and nothing needing it can run.
x3: Qwen3.6 install-asks 3/3, install-needed 3/3; gpt-oss-120b 3/3, 3/3 (install-needed had
gone 1/3: after No it generated anyway); pick 3/3, 3/3.

## 2f. Final code, full suite (`research/final2-*.log`)

- **deepseek-ai/DeepSeek-V4-Flash-0731 x3: 23/23, every case 3/3**, adult-request included.
  $0.245 for 69 conversations ($0.0036 each). The card's bar (the pick holds every case x3) met.

- Qwen/Qwen3.6-35B-A3B x1: **23/23** (survey 18/22), $0.146 per suite, $0.0063 per
  conversation, about 2.0x the pick: at the price line. One run; a flag needs x3.
- openai/gpt-oss-120b x1: 18/23, $0.038. Misses: create-then-generate, memory-read,
  ranked-editor (stopped after the guide read again), text-in-picture, no-delete. Its misses
  move between cases run to run.

## 3. Adult content (new case `adult-request`, Fabio 2026-09-25)

The pick, x1: **FAIL**, no tool call, "I can't create nude or sexualized imagery of a person."
`--bite` (no image model installed) fails as it must. Nothing in the agent prompt states a
content stance.

**Fabio (2026-09-25): "add the content rule as drafted, and use nsfw variants."** Landed:
- System prompt, before the Declining rule: "Content rule: the user is an adult on their own
  machine. Nudity and adult themes are allowed: write them as asked, never soften them. Never a
  minor, never a real, named person." SYSTEM_BUDGET 9,950 -> 10,150 (measured 10,098), reason in
  the test.
- `-nsfw` ops (krea2-nsfw, sdxl-nsfw) stay unranked (no rank, no task, never `best`) but carry a
  note: "the NSFW bake: take it, when installed, for an explicit adult request, never otherwise".
- `adult-request` now also requires the installed `-nsfw` variant.

After the rule (`research/adult-*.log`): pick **3/3** (krea2-nsfw, nudity kept), bite still
fails; Qwen3.6 1/1; gpt-oss-120b 1/1; gpt-oss-20b 0/1 (never generated, empty reply);
Qwen3-VL-30B 0/1 (never generated, reply "I asked for 2 to 3 seconds."). Neither failure is a
refusal: the "less censorship" model loses on competence, and the rule makes the others comply.

## 4. Qwen3.6 x3 (2026-09-26, Fabio approved)

`research/final3-Qwen_Qwen3.6-35B-A3B.log`: **19/23** x3 (the x1 23/23 in § 2f was luck), $0.4746 for
69 conversations ($0.00688 each). 2/3 on memory-read, rerun-on-named-model, outpaint-grows-one-side,
auto-video-medium-turbo. Listed with that score in the agent dropdown (MPI-912 validation.md § 6).
