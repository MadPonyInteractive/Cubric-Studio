# MPI-1277 validation

## Why (2026-10-24)

Cosmo on MiMo-V2.6-Flash (DeepInfra) took 45-60 s per step, then one call passed the 180 s limit
("DeepInfra did not answer within 180s"). In the same minute Gemma on DeepInfra described a picture
in 6.4 s (`[system] llm describe` line), so the host was up and only that model was stalling.
Fabio switched to DeepSeek-V4-Flash-0731 by hand, typed "Continue." and the turn finished at once.

## What shipped

- `agentFallbackModel(presetId, failedModel)` (`services/llmEngines.mjs`): the best other model scored
  on the same tests as the preset's agent model; '' where the preset has no agent model (Ollama, custom).
- `agentLoop.mjs` runTurn catch: on `TIMEOUT`, 429 or 5xx, `agent:error` carries `fallback`. A 401/402
  never does (another model would fail the same way).
- `MpiAgentChat`: a card under the error line, "My model is not answering." with Switch and continue
  (saves the model through `agentUseModel`, sends "Continue.") and Not now.

## Evidence

- `node --test tests/agent-loop.test.cjs`, (g): 6 new tests pass (fallback choice both ways, untested
  pick, Ollama/custom none; timeout/503/429 name DeepSeek-0731, 402/401 name nothing).
- `npm run lint` clean; `npm test` 3592 tests, 3590 pass, 0 fail.
- Live in my own `app:isolated` copy (fresh profile, no key): an emitted `agent:error` with `fallback`
  drew the card; Switch and continue removed it, set the agent model to
  `deepseek-ai/DeepSeek-V4-Flash-0731`, and sent "Continue." (answered NO_KEY, as a keyless copy should).

- Shipped in `1112c631` (pushed to master; pre-push lint + test green).
- Fabio, 2026-10-24: "The fallback card wording is fine, close MPI-1277."

## Not verified

- A real stall on a live key: it cannot be triggered on demand. Fabio sees it the next time a host stalls.
