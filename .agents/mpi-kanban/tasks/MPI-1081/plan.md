# MPI-1081 plan - r2v with nothing staged enhances as t2v

## Goal

Enhance on a reference-to-video op with no reference staged runs the recipe's `t2v` mode on the
plain idea, so the enhancer has no reference tag to invent. See brief.md for the evidence.

## Steps

1. `js/services/llmService.js` `enhance()`: after `resolveMode`, if the mode is `r2v`, `references`
   is empty (or absent) and the recipe has a `t2v` mode, use `t2v`. The `withReferences` line then
   never runs for an empty list.
2. Callers: only `MpiEnhanceDialog` passes an `operation`, and the prompt box always hands it
   `_stagedRefTags()`. `settleInGraphEnhance` passes no op (t2v already); Flows use `enhanceFlow`,
   not `enhance`; the agent/MCP have no enhance tool. So empty means nothing staged.
3. `tests/llm-service.test.cjs` `testEnhanceRunsTheOpsMode`: r2v rows pass a reference; new case
   r2v + `[]` -> t2v system prompt and the plain idea; r2v + one ref -> unchanged.
4. Wan 3.0 and LTX 2.3 validation records: note the no-ref r2v sweep tier now fails by design (the
   app no longer sends that case).

## Verification

**Verify mode:** auto

- `node --test tests/recipe-registry.test.cjs tests/agent-corpus.test.cjs tests/llm-service.test.cjs`

## Current State

All steps done and verified (validation.md). Uncommitted: llmService.js, llm-service.test.cjs,
wan-3.0/validation.md, this card folder. Next: `mpi-end-session` commits by pathspec and closes.

## Completed

Steps 1-4 (2026-10-11).

## Remaining Work

None.

## Plan Drift

- 2026-10-11: LTX 2.3 has no `docs/recipes/research/ltx-2.3/validation.md`; its note lives in
  this card's validation.md instead of a new docs file.
