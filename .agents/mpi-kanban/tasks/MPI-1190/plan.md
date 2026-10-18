# MPI-1190 plan - Cosmo offers a mask on a soft Character Sheet Editor area

Rescoped 2026-10-18 (Fabio, session "New character sheets 47"): Area mode (Prompt/Area switch,
SAM3 Detect, chips, per-area crop-edit-paste) is PARKED until after 2.1 - it stretched the
timeline. Instead, when a Character Sheet Editor result comes back soft or smudged in ONE area
(a tattoo on the back, an accessory), Cosmo offers the mask route the app already has: the user
paints that area on the result card, Cosmo runs Qwen-Image 2.1 `edit` on the mask with the
picture as a reference (Fabio's edit_011 proof, far sharper than the whole-sheet pass).

The blocker: the Route rule (`services/agentLoop.mjs`) says a character sheet "is never that
question: any change to it is Character Sheet Editor", so Cosmo never offers a mask on a sheet.

## Steps

1. Route rule: one clause - a sheet result soft in one area is offered a mask (app:flows).
   **Verify:** `node --test tests/agent-prompt-budget.test.cjs` (raise the budget with its note).
2. `docs/agent/flows.md` sheet paragraph: the how (paint on the result, Qwen edit + reference,
   one area per run, non-commercial). Reaches MCP agents too (read_knowledge app:flows).
3. Bench case `sheet-soft-area-mask` in `services/agentBench.mjs`: "the tattoo came out
   smudged" on a sheet -> no generate, reply offers a mask. Flip: a fresh tattoo ask -> runs the Flow.
   **Verify:** `npm run agent:test -- --case sheet-soft-area-mask` 3/3 + `--bite` on it fails,
   `npm run agent:test -- --case sheet-editor-shirt` still 3/3.

## Verification

**Verify mode:** auto

## Current State

Steps 1-3 done and verified (validation.md). Uncommitted. Next: `mpi-end-session` (commit by pathspec, close).

## Completed

Steps 1-3. flows.md text is ONE long line appended to the sheet paragraph: the doc sits at the 200-line cap.

## Remaining Work

Close-out only.

## Plan Drift
