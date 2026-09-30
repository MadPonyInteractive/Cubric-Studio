# MPI-1002 Validation

## Built (2026-09-30, session 43678b37, phase 2 of MPI-1000; Fabio chose option A)

- Step 1: `js/services/flowEnhance.js` (new) is the shared enhance primitive; `runEnhanceDecl` is the
  only Flow-path caller of `llmService.enhanceFlow` and logs `[flow-enhance] <flow> enhanced on
  <backend> (<model>), N ms`. MpiBaseFlow keeps UI state only; the hand run builds byte-identical
  enhancer requests (golden captured from HEAD's code: 5 prompts + 2 whole `/llm/enhance` bodies).
- Step 2: `agentFieldSpecs` omits `hidden: true` fields (Song's three caption blocks);
  `resolveFlowFieldValues` ignores caller values for them with one warn (no `unknown`) and returns
  the raw `resolved`; a voices cast sent as text now round-trips instead of being dropped.
- Step 3: `settleInGraphEnhance` (llmService) called once in `commandExecutor.runCommand` before
  params are built (the one point local and Pod both pass): an in-graph enhancer flag with a
  non-ComfyUI pick is enhanced on the picked backend with the model's recipe and the graph node
  switched off; exempt ops forced off; a failed enhancer stops the job. Stale "app toggle" docs fixed.
- Step 4: `adoptHiddenTargets` at the frame's seed: an agent-opened Song's blocks count as
  machine-written, so Review lyrics then Cue enhances once.
- Step 5: `docs/agent/flows.md` tells Cosmo how Song's fields work (section tags only, one voice row
  per singer, who sings where in voice notes, never send the three blocks).
- Step 6: `buildFlow` (agentDispatch) calls `enhanceFlowRun` after the fields resolve; a failed
  enhancer refuses; the patch reaches the graph params and the saved snapshot (`enhanceWrote`).
  Wrong-field refusals list only the fields the agent was shown. Routines enhance too (same door).

## Evidence

- `node --test tests/flow-enhance.test.cjs tests/enhance-control.test.cjs tests/flow-enhance-ownership.test.cjs`: 32 pass.
- `node --test tests/connector-flow-dispatch.test.cjs`: 14 pass (worker mutation: 4 new tests fail on HEAD's file).
- `node --test tests/in-graph-enhance.test.cjs tests/output-prompt-capture.test.cjs`: 77 pass; llm-service 31 pass
  (9 flag spellings x 3 picks x 2 ops; real `enhance()` with only fetch stubbed; 3 mutations caught).
- `node --test tests/flow-enhance-agent.test.cjs` + agent-flow-handover, routine-runner, connector-flow-dispatch,
  agent-dispatch: 44 pass.
- `npx playwright test --config=playwright.desktop.config.js tests/desktop/flow-enhance-writes-textarea.spec.js`: 2 passed (hand path unchanged).
- `npm test`: 2572 pass, 0 fail, 2 skipped. Lint clean.

## Left: the live matrix (step 7) - needs Fabio's local ComfyUI and a few DeepInfra calls (cents)

1. Remote on DeepInfra. Ask Cosmo for a duet. The log says `[flow-enhance] Song enhanced on endpoint`; no `promptEnhance` job.
2. Same on Ollama, then on ComfyUI (a `promptEnhance` job runs first).
3. Song by hand on DeepInfra: the three blocks fill, no ComfyUI enhance job.
4. Cosmo opens a Song, Review lyrics, Cue: one enhance pass; Cue again unchanged: none.
