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
