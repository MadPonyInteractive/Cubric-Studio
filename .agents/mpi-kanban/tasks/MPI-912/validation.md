# MPI-912 Validation

## 1. Enhance flag

- One list: `RECOMMENDED_REMOTE_MODELS.ollama` (`services/llmEngines.mjs`) carries
  `huihui_ai/gemma-4-abliterated:12b` for `enhance`, the enhancer of record. The Ollama
  connection's rows read it through `listRemoteModels`; the Ollama enhance backend's dropdown
  reads it through `GET /llm/models` (`recommended`, matched by `ollamaTagged(ollamaName)`),
  labelled `(recommended) <name>` like the Remote rows.
- Behaviour change, intended: on the Ollama connection an EMPTY enhance pick now runs the
  recommended model (`routes/llm.js` `recommendedModel(profileId, 'enhance')`), as every
  Remote preset already does. The Ollama BACKEND default stays `gemma-4-e4b`.
- `node --test tests/llm-connection.test.cjs tests/llm-service.test.cjs tests/llm-describe.test.cjs`
  -> 34 pass, 0 fail, including the new MPI-912 case (both surfaces flag the same model).

## 2. Describe bench

Harness: `research/vision-bench.mjs` (MPI-817's, plus `BENCH_BASE`), the same Cowgirl on a Bull
picture (`.preview-assets/0fd0e19d…png`) and truth file, through Ollama's `/v1` shim, which is
the path production's describe route takes on the Ollama connection (`DeepInfraEngine` on the
profile's base URL). Log and answers: `research/ollama-describe.log`, `ollama-describe-results.json`.

Run 1 (2026-09-25, `max_tokens` 700, temperature 0):

| model | must-hits | wrong | what came back |
|---|---|---|---|
| gemma3:12b | 9/10 (missed horn) | guns "pointed upwards and outwards, arms extended" | a real description |
| qwen3-vl:4b | 0/10 | - | EMPTY, 700 tokens spent |
| huihui_ai/qwen3-vl-abliterated:4b | 0/10 | - | EMPTY, 700 tokens spent |
| gemma4:e4b | 0/10 | - | "an abstract digital texture ... black background": it never saw the picture |
| huihui_ai/gemma-4-abliterated:12b | 0/10 | - | EMPTY, 700 tokens spent |
| qwen3.5:latest (9B) | 0/10 | - | EMPTY, 700 tokens spent |

No local model earns the describe flag on this run. Two failure shapes to separate before
calling it a model verdict rather than a path verdict: EMPTY (a reasoning channel eating the
budget through the shim, which has no `think` flag) and BLIND (the image not reaching the
model). Both are what a user on the Ollama connection would get today.

**Path fix (same card):** describe and the enhance endpoint branch now take
`chatEngineFor(profileId, key, baseURL, profile)` (native `OllamaEngine`, `think: false`), and
`toOllamaMessages` converts `image_url` parts to native `images`. Tests: `llm-describe`
MPI-912 describe + enhance cases (written failing first: the describe case got `''` from the
shim), the keyless-connection case re-pinned to `/api/chat` with its no-key intent kept.
`node --test tests/llm-describe.test.cjs tests/llm-connection.test.cjs tests/llm-service.test.cjs tests/agent-loop.test.cjs`
-> 150 pass, 0 fail. `npm test` -> 1867/1870, the one fail is `gallery-card-teardown` on
MPI-906's uncommitted `MpiGalleryGrid.js`, not this card. eslint clean.
**Run 1 is a PATH verdict. Re-run on the native path before any describe flag.**

Run 2, native path (production's exact call: `chatEngineFor('ollama')`, no temperature or cap).
Log `research/ollama-describe-native.log`:

| model | must-hits | wrong | secs |
|---|---|---|---|
| qwen3.5:latest (9B) | 9/10 (missed sepia) | none | 16 |
| gemma3:12b | 9/10 | guns "upwards and outwards, arms extended" (2 patterns) | 20 |
| qwen3-vl:4b | 8/10 | none | 27 |
| huihui_ai/gemma-4-abliterated:12b | 8/10 | none | 14 |
| huihui_ai/qwen3-vl-abliterated:4b | 7/10 | none | 28 |
| gemma4:e4b | 2/10 | invented a DIFFERENT picture ("three young women seated on a bench") | 22 |

The fix holds: every EMPTY model now answers. gemma4:e4b hallucinates the whole image on the
same path where gemma-4-abliterated:12b sees it: a model/build fault, not ours.

Run 3, repeats (`research/ollama-describe-repeat.log`): qwen3.5 9/0, 9/0, 10/**1 wrong**
(guns "to the side", the exact MPI-817 failure); gemma-4-abliterated 8/0, 8/0, 9/0 (omits the
gun direction, never misstates it). **No local describer meets the DeepInfra bar (10/10,
nothing wrong): describe stays unflagged.** One picture only.

## 3. Agent

`scripts/agent-test.mjs --preset ollama --model <tag>` runs the real loop through the real
`OllamaEngine` (`chatEngineFor('ollama')`, 32k context, `think: false`), same 22 graded cases.

- qwen3.5:latest (9B), `--runs 1`, STOPPED after 3 of 22 cases (Fabio needed the GPU,
  2026-09-25): `picks-installed-model` FAIL (invented model `midjourney6`, op `txt2i`, a turbo
  param klein-9b/t2i does not take), `install-needed` pass, `auto-video-medium-turbo` pass.
  ~20-107 s per case. Log: `research/agent-qwen3.5-9b.log`. Resume when the GPU is free.

Full screens, `--runs 1`, 22 cases (logs `research/agent-<model>.log`):

| model | pass | notes |
|---|---|---|
| qwen3.5:latest (9B) | 9/22 | invents model ids (`midjourney6`, op `txt2i`); skips memory reads; misses the ranked editor |
| huihui_ai/gemma-4-abliterated:12b | 2/22 | generates with no model installed, calls `delete_card` on a delete request, `look` on a video |
| gemma4:e4b | 3/22 | same shape, faster and shallower |

Tool calls PARSE (arguments arrive intact through `fromOllamaToolCalls`), so these are model
verdicts, not a plumbing fault. Next (Fabio, 2026-09-25): pull `ornith:9b` and `gemma4:12b`
(the non-abliterated 12B); `gemma4:26b` (19 GB) only if both fail, because it takes the whole
16 GB card the agent's own generations need.

| model (pulled 2026-09-25) | pass | failures |
|---|---|---|
| gemma4:12b | **14/22** | turbo on an op without it; generated with no video model installed; i2i instead of a t2i re-run; i2v instead of ref2v for a sheet; never ran Outpaint; never measured a box; two turns that never generated |
| ornith:9b (5.6 GB) | 11/22 | ask-first, look-refusal, memory-write, ranked-editor, re-run, text-in-picture, sheet, outpaint, box |

**Abliteration costs the agent almost everything:** gemma4:12b 14/22 against its abliterated
build's 2/22 on the same suite. Bar: the DeepInfra agent model passes 22/22 three times.
**No local agent flag.**

gemma4:12b describe, 3 runs (`research/ollama-describe-gemma4-12b.log`): 9, 10, 10 of 10, but
every run says the guns point "outward" (flagged wrong by the truth file). Closest yet; still
under the bar, so describe stays unflagged.

## 4. Agent flags beyond the local card (Fabio, 2026-09-25)

Fabio's direction: recommend DeepSeek V4 Flash for Ollama CLOUD, and Gemma 4 26B for Ollama
LOCAL (24-32 GB cards), testing the 26B on DeepInfra since his 16 GB card cannot hold it.

- **DeepSeek V4 Flash is cloud-only on Ollama.** 304B parameters (HF safetensors total), ~150 GB
  even at 4-bit; Ollama ships only `deepseek-v4-flash:cloud` and `:0731-cloud` (the same 0731
  snapshot DeepInfra serves). Pulled `deepseek-v4-flash:0731-cloud` (a manifest stub).
- **It is NOT in Ollama's free usage.** `agent-test --preset ollama --model
  deepseek-v4-flash:0731-cloud --runs 1` -> 0/22, every case `402 Payment Required`; the body:
  "this model is not included in your free usage, add usage credits to pay as you go ... or
  upgrade". Fabio's account is `plan: free` (`POST /api/me`). Log:
  `research/agent-deepseek-v4-flash_0731-cloud.log`. A path verdict is impossible without paid
  usage; the model verdict (22/22 x3 on DeepInfra) stands but the Ollama path
  (`think: false`, where DeepInfra needed `reasoning_effort: 'low'`, MPI-891) is unmeasured.
- **Gemma 4 26B:** Ollama `gemma4:26b` is 25.2B params, Q4_K_M, 19 GB with projector and draft
  model. DeepInfra `google/gemma-4-26B-A4B-it` is the same model at higher precision, so a
  DeepInfra pass is an upper bound for the local Q4 build, not proof of it.
- **Gemma 4 26B on DeepInfra: 14/22** (`agent-test --model google/gemma-4-26B-A4B-it --runs 1`,
  $0.063 for the suite; log `research/agent-deepinfra-gemma-4-26B-A4B.log`). The SAME score as
  gemma4:12b local, with the same failure shapes: turbo on klein-9b/t2i, i2i instead of a t2i
  re-run, i2v instead of ref2v for a sheet, never measured a head box, no generate after opening
  a project, never read `mira.md`, never saved the 16:9 note, first ranked-editor turn never
  generated. At full precision it already misses the bar (22/22 x3), so the local Q4 build
  cannot earn it. **No gemma4:26b flag**; it buys nothing over gemma4:12b on this suite.
- Outcome: no Ollama agent flag of any kind. A user who wants Flash has it flagged, tested and
  pay-per-token on the DeepInfra connection already.

## 5. DeepInfra agent survey (Fabio, 2026-09-25: "recommend more than one", maybe a cheapest flag)

Screens, `agent-test --model <id> --runs 1`, no `reasoningEffort` (only listed models get one).
Logs `research/agent-deepinfra-<slug>.log`. Price = DeepInfra list $/1M in / out (cached in).

| model | pass | suite cost | $/1M | failed |
|---|---|---|---|---|
| deepseek-ai/DeepSeek-V4.1-Flash | 21/22 | $0.233 | 0.20 / 0.60 (0.006), vision | ranked-editor (krea2Edit over kleinEdit) |
| zai-org/GLM-5.3-Flash | 20/22 | $0.163 | 0.15 / 0.50 (0.03), vision, 50% promo | rerun (i2i), sheet (no op) |
| XiaomiMiMo/MiMo-V2.6-Flash | 20/22 | $0.164 | 0.14 / 0.28 (0.0028), vision | rerun (i2i), over-boxed-head |
| Qwen/Qwen3.6-35B-A3B | 18/22 | $0.135 | 0.10 / 0.95, vision, on Ollama | install-asks, rerun, sheet, head |
| Qwen/Qwen3.8-Flash | 17/22 | $0.169 | 0.11 / 0.38 (0.014) | video-limit, open-by-name, brief, memory-write, sheet |
| openai/gpt-oss-120b | 14/22 | $0.035 | 0.037 / 0.17 | 8 incl. no-delete |
| google/gemma-4-26B-A4B-it | 14/22 | $0.063 | 0.07 / 0.34 | § 4 |
| ByteDance/Seed-2.0-mini | 13/22 | $0.262 | 0.10 / 0.40 | 9, three endpoint errors |
| openai/gpt-oss-20b | 10/22 | $0.024 | 0.03 / 0.14, 14 GB on Ollama | 12, "never generated" x5 |
| nvidia/Nemotron-3-Nano-30B-A3B | 10/22 | $0.096 | 0.05 / 0.20, on Ollama | 12 |
| Qwen/Qwen3-VL-30B-A3B-Instruct | 7/22 | $0.225 | 0.15 / 0.60 | 15, called a nonexistent `delete_project` |

**Qwen3-VL-30B lost its agent flag** (Fabio, 2026-09-25): it had carried "less censorship"
since MPI-774 on one refusal test, never the suite. `services/llmEngines.mjs` entry removed;
`tests/llm-describe.test.cjs` now pins it unflagged and keeps the no-content-promise guard.
`node --test tests/llm-describe.test.cjs tests/llm-connection.test.cjs tests/llm-service.test.cjs tests/agent-loop.test.cjs`
-> 151 pass, 0 fail, 1 skipped; eslint clean.

**Baseline, same day:** `deepseek-ai/DeepSeek-V4-Flash-0731` (the pick, `reasoningEffort: 'low'`
from the list) -> **21/22**, $0.0724 per suite ($0.0033 per conversation); failed
`rerun-on-named-model`. So the pick no longer holds 22/22 on today's suite either. Fabio's price
rule: nothing over 2x the pick's OFF-promo price (DeepInfra's API `pricing` is the full price;
promos show only on the website, e.g. GLM-5.3-Flash $0.075 promo vs $0.15 full). 2x = ~$0.145
per suite: GLM (2.3x), MiMo (2.3x) and V4.1-Flash (3.2x) are out on price whatever they score.
Carried to MPI-916 (tool contracts so cheaper models pass).

The hard cases, failed by nearly everyone: `rerun-on-named-model` (i2i instead of a t2i re-run),
`sheet-goes-to-reference`, `over-boxed-head`, `ranked-editor`.
