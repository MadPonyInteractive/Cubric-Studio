# MPI-912 Plan: recommended flags on Ollama models, per job

## Goal

A local user can see which Ollama model to pick for each job (enhance, describe, agent), and
every flag rests on a measured result. A flag nobody earned is worse than none
(`services/llmEngines.mjs`, the `RECOMMENDED_REMOTE_MODELS` note).

## Where Ollama models are listed today (none flagged)

1. **Enhancement backend = Ollama:** the dropdown lists `MODEL_REGISTRY` entries with an
   `ollamaName` (`MpiLlmSettings.js` `_renderModel`, fed by `GET /llm/models`). No marker.
2. **Connection provider = Ollama (local):** the per-job rows (agent, enhance on Remote,
   describe on Remote) list Ollama's `/v1/models` through `listRemoteModels`, labelled from
   `RECOMMENDED_REMOTE_MODELS[presetId]`, which has no `ollama` key ("Custom and Ollama get no
   hints").

Budget: Fabio's card is an RTX 4060 Ti, 16 GB. The agent asks Ollama for 32k context
(`OLLAMA_AGENT_CONTEXT`), so an agent model's weights plus KV cache must fit well under that.

## Phases

### 1. Enhance (evidence exists)

- `gemma-4-abliterated-12b` is the enhancer of record: every v1 recipe is Stage 1 green on it.
  Flag it for `enhance` in both lists: a `recommendedFor` on its `MODEL_REGISTRY` entry,
  carried through `GET /llm/models` and shown as `(recommended) <name>` in the backend
  dropdown; and `RECOMMENDED_REMOTE_MODELS.ollama` with the exact `/v1/models` id
  `huihui_ai/gemma-4-abliterated:12b`.
- The DEFAULT stays `gemma-4-e4b` (a product call, not this card's).
- **Verify:** `node --test tests/llm-connection.test.cjs` (+ a case for the ollama preset);
  the dropdown label read in an isolated app.

### 2. Describe (score before flagging)

- Bench the installed Ollama vision models with MPI-817's scored harness
  (`tasks/MPI-817/research/vision-bench.mjs`, copied here and pointed at
  `http://localhost:11434/v1`) on the same picture and truth file (`cowgirl.truth.json`).
  Candidates: `qwen3-vl:4b`, `huihui_ai/qwen3-vl-abliterated:4b`, `gemma3:12b`, `gemma4:e4b`,
  `huihui_ai/gemma-4-abliterated:12b` (if it takes images). Under the GPU lease.
- Flag the best for `describe` only if it scores like the DeepInfra pick (10/10, nothing
  wrong); otherwise leave describe unflagged and record the scores.

### 3. Agent (research first)

- Shortlist tool-calling models from Ollama's library that fit 16 GB at 32k context
  (installed first: `qwen3.5:latest`, `gemma4:e4b`, `huihui_ai/gemma-4-abliterated:12b`; then
  the library's tools category). Dolphin 3 is the known failure (Fabio).
- `scripts/agent-test.mjs` gains `--preset ollama` (profile `ollama`, base
  `http://localhost:11434/v1`, no key), so the real loop runs on the local model with the same
  22 graded cases. Screen at `--runs 1`, then `--runs 3` on the best.
- Flag for `agent` only a model that passes the suite; otherwise no agent flag, and the
  findings go in `validation.md` and the Ollama connection note.

## Files

`services/llmEngines.mjs`, `routes/llm.js`, `js/components/Organisms/MpiLlmSettings/MpiLlmSettings.js`,
`scripts/agent-test.mjs`, `tests/llm-connection.test.cjs`, `docs/agent/prompt-enhancement.md`
(if it describes the hints), `.agents/mpi-kanban/tasks/MPI-912/`.

## Verification

**Verify mode:** auto

Unit tests green; the describe and agent flags only on a recorded passing score; the labels
read in an isolated app (`npm run app:isolated`), never `:3000`.

## Current State

- 2026-09-25: phase 1 done (flag + tests). Phase 2 ran once and exposed a path bug, now fixed
  (see Plan Drift); the describe bench must be RE-RUN on the native path before any flag.
  Phase 3 harness done; qwen3.5 screen stopped at 3/22 when Fabio took the GPU.
- Describe re-benched on the native path: no local model meets the bar, describe stays
  unflagged (Fabio agreed). Agent screens: qwen3.5 9/22, gemma-4-abliterated 2/22,
  gemma4:e4b 3/22 (validation.md § 3).
- Pulled `ornith:9b` and `gemma4:12b` (Fabio approved). Agent: gemma4:12b 14/22, ornith 11/22.
  gemma4:12b describe 9/10/10 but "outward" every run. **No local agent or describe flag.**
- Recommended to Fabio: close MPI-912 as is (enhance flag + native-path fix + harness +
  recorded scores); `gemma4:26b` (19 GB) as a SEPARATE card, only for RunPod users whose local
  GPU is idle. He read a third-party guide (gemma4-ai.com, uncited): it says 4K-8K context on
  16 GB, which cannot hold the agent's 32K (calls ran 7K-20K+ prompt tokens). Awaiting his
  answer: close, or card the 26B test.
- Code, tests and research committed at handoff (2026-09-25).

## Completed

- Phase 1: `RECOMMENDED_REMOTE_MODELS.ollama` enhance flag, `/llm/models` `recommended`,
  `(recommended)` label, test.
- Describe/enhance on the Ollama connection routed native (`chatEngineFor`), images converted.
- `agent-test.mjs --preset ollama`.

## Plan Drift

- 2026-09-25: the first describe bench scored 0/10 on five of six local models: four EMPTY
  (reasoning through the `/v1` shim, no `think` flag) and gemma4:e4b BLIND (described noise).
  Root cause in two places, both fixed in this card: `routes/llm.js` describe and enhance
  built `DeepInfraEngine` on the shim instead of `chatEngineFor` (which exists for exactly
  this), and `toOllamaMessages` passed OpenAI `image_url` parts to the native API unconverted.
  A user on the Ollama connection got empty or wrong descriptions before this.
