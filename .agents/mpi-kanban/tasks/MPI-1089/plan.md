# MPI-1089 plan

## Current State

Fabio 2026-10-11 confirmed the shape: the edit runs on the sheet WITH its head, then head removal lands as the
next history entry; the toggle only swaps between the two. That already holds for a Flow's own result (MPI-997).
The hole: the user can PICK the head-removed version of a card as the input.

## Fix

`js/services/flowService.js`, `submitFlowGeneration`, leg 1 only: an input picture that is the toggle leg's own
output (op `flowCharacterSheetHeadless`) is swapped for the version it was made from, the history entry right
before it in the same card (the leg always lands right after the picture it edited). Pure helper, unit-tested.

## Verification

**Verify mode:** user-ux
- `node --test tests/flow-chain.test.cjs` (new cases: headless pick -> with-head sibling; plain pick unchanged;
  head-removed entry with nothing before it unchanged).
- Fabio: Editor on a card whose shown version is head-removed -> result has a head, second entry removes it once,
  hair intact.

## Completed

## Plan Drift
