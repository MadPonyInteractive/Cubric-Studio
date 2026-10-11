# MPI-1091 plan - Character Sheet Flows (umbrella)

## Current State

2026-10-11 (session "New character sheets 20"): MPI-1089 DONE (head-removed pick -> with-head version, 406dbec1e).
MPI-1087 DONE (head removal always runs as a `toggle` leg, left field is the one switch, result button gone,
Compare <-> Result on compare-only Flows; 341665198). Fabio passed both, plus a child-gate bonus check.
Still owed from MPI-1087: two UNRELEASED.md lines, text in `tasks/MPI-1087/validation.md` § Pending - the file was
claimed by peer e6751fca (MPI-1073); add them when it frees up.
NEXT: MPI-1090 (clothes round 2) - bench needs the GPU: ask Fabio first. Then MPI-1086.

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
