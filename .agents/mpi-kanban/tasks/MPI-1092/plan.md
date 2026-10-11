# MPI-1092 plan - chained Flow runs show their step

## Current State

2026-10-11: Fabio (screenshot, Character Sheet Editor, Clothes + age 10): the status bar read "DRAWING THE SHEET · 1"
on every leg. The "· 1" is the graph's own sampler stage with no total; nothing says which leg of the run is running,
and the early legs show half-made sheets, so a user may stop a run that is going fine. Every chained Flow shares the
path (`flowService.submitFlowGeneration`).
SHIPPED f3ec8cb40 (pushed). Card validating: Fabio's eye test (reload, run a chained Character Sheet edit). Note the
head removal is always the last step (MPI-1087), so Clothes + age reads 1/4..4/4, not 3.

## Plan

- `flowStep(flow, run, index)` in `js/services/flowService.js`: the leg's place among the jobs this run takes, "2/3",
  null for a one-job run or a leg run alone. Stamped on the job config as `flowStep`.
- `js/services/generationService.js`: `tool:running` carries `step`.
- `js/shell/statusBar.js`: the label reads `EDITING THE SHEET 2/3`; a total-less graph stage ("· 1") is dropped while a
  step shows.
- Test in `tests/flow-chain.test.cjs`.

## Verification

**Verify mode:** user-ux

- `node --test tests/flow-chain.test.cjs tests/flow-legs.test.cjs` passes.
- Fabio runs a chained Character Sheet edit and reads 1/N ... N/N in the status bar.

## Completed

## Plan Drift
