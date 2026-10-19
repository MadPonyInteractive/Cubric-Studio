# MPI-1201 validation

## What was seen (live, 2026-10-19)

A sheet with two pairs of legs, a walking clip and a hallway picture, "the legs walk down this
hallway with the clip's motion". Cosmo read app:flows, `minimax-h3-ref2va` settings and
guide:minimax-h3, then asked which pair with `[options]`. Told to use the model directly, it sent
the whole sheet to `ref2v_ms` with both pairs named, and the result looked good (app.log
13:26:17Z, ratio 16:9, medium, turbo, duration 5).

## Root cause

Nothing in the system prompt said a reference op takes a several-subject picture as it is. The
Model rule's own "unsure which: ask" for reference-vs-edit read as licence to ask which subject.

## Fix

- `services/agentLoop.mjs` Model rule: "A reference picture of several people or things the words
  do not choose between goes in whole, each named in the prompt; ask which only when the words mean
  ONE and the picture cannot tell." (+189 bytes)
- `tests/agent-prompt-budget.test.cjs`: SYSTEM_BUDGET 11,885 -> 12,074, reason recorded.
- `services/agentBench.mjs`: case `several-subjects-reference-whole` (look fixtures for the sheet,
  the clip and the hallway; expects a ref2v generate with the sheet in media and both pairs named;
  the flip asks for ONE pair, where a question is right).
- `docs/agent-findings.md`: finding added; four paragraphs re-wrapped (words unchanged) to stay at
  200 lines.

## Evidence

- `node --test tests/agent-prompt-budget.test.cjs tests/agent-loop.test.cjs`: 204 tests, 203 pass,
  1 skipped, 0 fail.
- `node --test tests/agent-bench.test.cjs tests/bench-community.test.cjs
  tests/connector-agent-tools.test.cjs tests/model-priority.test.cjs`: 71 pass, 0 fail.

## Not run

The new bench case was not run against a live model: `npm run agent:test -- --case
several-subjects-reference-whole` bills the DeepInfra key (3 runs + 1 bite run). Run it before
trusting the sentence on other models.
