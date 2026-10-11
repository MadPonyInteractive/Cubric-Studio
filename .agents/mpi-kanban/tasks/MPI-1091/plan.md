# MPI-1091 plan - Character Sheet Flows (umbrella)

## Current State

Created 2026-10-11. Nothing started. GPU held by Fabio's own tests: no bench until he says.

## Phase 1 - Clothes (Fabio: first)

- MPI-1089 (breaker): Editor input from a headless sheet. Code only, diagnosable without the GPU.
- MPI-1090: bench, then the builder.

## Parallel Batch - Phase 1

- MPI-1089 - Ownership: `js/data/flowsRegistry.js` (chain / flowLegs section), the flowService chain run,
  `js/components/Blocks/MpiBaseFlow/MpiBaseFlow.js` if the input resolves the with-head sibling.
  **Verify:** unit test on the leg decision + Fabio re-runs a clothes edit on a headless sheet.
- MPI-1090 - Ownership: `js/data/flowPrompts/characterSheetEditor.js`, its tests, the playbook
  `docs/playbooks/add-flow/existing-flows/character-sheet-editor.md`.
  **Verify:** bench evidence in its validation.md + Fabio's eye test.

## Phase 2 - Hair and accessories

- MPI-1086: same builder file as MPI-1090, so after it.

## Phase 3 - UI

- MPI-1087: same chain code as MPI-1089, so after it. MPI-1088 deferred (later version).

## Plan Drift

(none yet)
