# MPI-1281 validation

- `services/agentBench.mjs` 'ask-first': the first turn asks when its reply has a "?" OR the Options rule's
  buttons (`turn.options`). The "generated in the first turn" and "did not generate once answered" checks are unchanged.
- `tests/agent-bench.test.cjs` 'MPI-1281': question passes, buttons with no "?" pass (MiMo re-run #3's shape),
  a statement with no buttons fails, a first-turn generate fails. 18/18; eslint clean. No DeepInfra run.
- The suite hash moves e4f83ddc0bfe -> 30dd5a845c08 (a check's source is part of it): shipped `agentTest` stamps
  in `services/llmEngines.mjs` and users' own bench scores read "(older tests)" until handled.

## Noticed
- MPI-1280 suite run #1: the model sent its ask as a tool call named `[options:` (UNKNOWN_TOOL), then ended on
  empty text; `agentLoop` emits an empty agent:message, so the user sees an empty Cosmo bubble. One-off model glitch.
- llmEngines.mjs: the four 55-case agentTest stamps re-stamped 30dd5a845c08 unrun (Fabio 2026-10-24), comment says why. npm test 3610 pass 0 fail; lint clean.
