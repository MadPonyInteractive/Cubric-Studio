# MPI-1188 plan - UI polish

Umbrella, Fabio 2026-10-18 (board tidy). Small UI fixes and finishes, each its own card.
**A menu, not a sequence:** pick any row; work happens on the member card.

**Umbrella rule:** every member's `description` starts with
`UMBRELLA: MPI-1188 - UI polish. Menu: tasks/MPI-1188/plan.md.`

## The menu

| Card | Job | Touches | Blocked on |
|---|---|---|---|
| MPI-868 | IMAGE and VIDEO labels carry their family colours (Vision rose, Video orange) | media label CSS on four surfaces | Nothing; Fabio has asked more than once |
| MPI-801 | Eyedropper: Alt-pick in the Paint tools, and a Pick in the Flows' paint step | `js/components/Organisms/MpiStepPaint/*` | Nothing |
| MPI-367 | Per-op help: fix the copy, add per-model specificity and imagery | `js/data/commandRegistry.js` | Nothing |
| MPI-322 | Gallery windowing: render only on-screen cards for very large projects | gallery grid | Nothing |

## Parallel Batch

All four touch different files and can run together.
