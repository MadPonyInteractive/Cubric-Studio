# MPI-1040 - Decision models via DeepInfra

**Status: BLOCKED until DeepInfra hosts a decision model.** Fabio's call, 2026-10-08: build
nothing before then. No local Ollama route (a 9B model in VRAM next to ComfyUI), no Cloudflare
Workers AI (a second cloud provider breaks the DeepInfra-only rule). A weekly scheduled task,
`deepinfra-decision-models-check`, watches the DeepInfra catalogue and says when this unblocks.

## What a decision model is

A model that answers typed questions about a "state" (text, JSON, for some models images)
with probabilities instead of prose. One pass, about 4 output tokens, output can never be
malformed. Started by TypeSafe AI's Jev (hosted only, 2026-09-15); open copies speak the same
API (`POST /v1/systemone` in Ollama 0.35+):

- `choice` - one of N named options, per-option probabilities + confidence
- `noul` - yes/no, one probability
- `score` - a place on an ordered scale, can land between levels, + confidence

Request: `{ model, state, questions: { <name>: { type, instructions, criteria } } }`.
Response: `{ answers: { <name>: { choice | noul | score, probabilities, confidence } }, usage }`.

| Model | From | Size | Images | Licence |
|---|---|---|---|---|
| Clef / Clef-flash | Cloudflare | 27B / 9B | yes, up to 4 | Apache 2.0 |
| Nimble | Bespoke Labs | 9B | no | Apache 2.0 (reported) |
| Tev1 / tev1:0.8b | Together AI | 4B / 0.8B | no | not stated, "experimental" |
| OpenJev | independent | 27B / 9B | no | **CC BY-NC 4.0 - not shippable** |

## Unblock trigger

DeepInfra's keyless catalogue (`https://api.deepinfra.com/models/list`) gains any of the above,
or any model with a Jev-style typed-answer API. On 2026-10-08 it had none (386 models; nearest
relatives: Llama-Guard-4-12B, Qwen3 rerankers, CLIP zero-shot image classification).

## First job once unblocked

1. Read the DeepInfra model page: endpoint shape (`/v1/systemone`-compatible or its own),
   price (input-only?), image input, context window, licence.
2. **Measure before building.** Pick ONE use below, run 20-50 real cases through the decision
   model and through today's LLM path, compare cost, latency and accuracy. Ship only if it wins.
3. Engine: sits beside `DeepInfraEngine` in `services/llmEngines.mjs` (same key, same host) as a
   `decide(state, questions)` call, not a chat turn.

## Candidate uses, best first

1. **Best-of-N picking / output QA** (needs image input, so Clef-class): score each candidate
   for "same character as the reference?", "extra fingers?", "matches the prompt?".
2. **Routing before an agent turn**: which Flow or model fits a request. Saves money only if it
   REPLACES a Cosmo turn (`services/agentLoop.mjs`), not if Cosmo still runs one after it.
3. **Prompt moderation**: one yes/no.

## Why the saving is smaller than the headline

Input tokens are still billed, and Cosmo's bill is mostly re-sent context, not output. The win
is only where a decision replaces a whole LLM turn. Confidence is not correctness; TypeSafe's
own docs say these models are weak at counting, arithmetic and date comparison, so keep maths
in code.

## Sources

- https://ollama.com/blog/ollama-now-supports-jev-style-decision-models
- https://developers.cloudflare.com/changelog/post/2026-10-01-clef-workers-ai/
- https://huggingface.co/Cloudflare/clef-flash
- https://www.infoq.com/news/2026/10/typesafe-ai-jev-released/
- https://huggingface.co/openjev
