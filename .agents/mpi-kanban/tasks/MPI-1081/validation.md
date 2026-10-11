# MPI-1081 validation

Verify mode: auto.

## 2026-10-11 - passed

- `node --test tests/recipe-registry.test.cjs tests/agent-corpus.test.cjs tests/llm-service.test.cjs`:
  3 files pass, 0 fail. `node tests/llm-service.test.cjs`: 31 of 31.
- New case in `testEnhanceRunsTheOpsMode`: `ref2v` with `[]` (Seedance, LTX 2.3) and with no
  `references` at all (Wan 3.0) sends the recipe's `t2v` system prompt and the plain idea; LTX 2.3
  with one reference keeps `r2v` and the "Attached references, in load order: @image1." line.
- Mutation check: with the new branch disabled (`false && ...`), the test FAILS
  ("seedance-2.0 r2v with nothing staged runs t2v"); restored, 31/31.

## Callers (empty means nothing staged)

Only `MpiEnhanceDialog` passes an `operation`; the prompt box always hands it
`_stagedRefTags()` mapped through `refTagHandle`. `settleInGraphEnhance` passes no op (t2v
already). Flows run `enhanceFlow`, not `enhance`. The agent and MCP have no enhance tool. Absent
`references` is treated as empty too: nothing said = nothing to reference.

## Records

- Wan 3.0: `docs/recipes/research/wan-3.0/validation.md` open case annotated as closed in the
  app; the `--mode r2v` no-ref sweep tier keeps failing by design.
- LTX 2.3 has no `validation.md` (its Stage 1 sits in MPI-1060's validation.md § Recipe r2v
  Stage 1); same note applies there: `scripts/recipe-test.mjs --mode r2v` no-ref tier is no
  longer a case the app sends.
- Seedance no-ref now runs its `t2v` mode, its default and Stage-1-proven mode; no sweep re-run
  (it would only re-test t2v).
