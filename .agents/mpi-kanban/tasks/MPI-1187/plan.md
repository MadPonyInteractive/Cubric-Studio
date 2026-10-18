# MPI-1187 plan - Model Library housekeeping

Umbrella, Fabio 2026-10-18 (board tidy). The shipped model and dependency estate: what we
retire, clean up and credit, plus the install-state work MPI-513 (closed 2026-10-01) left open.
**A menu, not a sequence:** pick any row whose blocker is clear; work happens on the member card.

**Umbrella rule:** every member's `description` starts with
`UMBRELLA: MPI-1187 - Model Library housekeeping. Menu: tasks/MPI-1187/plan.md.`

## The menu

| Card | Job | Touches | Blocked on |
|---|---|---|---|
| MPI-603 | Retire the outpaint LoRA; give the Character Sheet Flow its own answer | `comfy_workflows/*flow_character_sheet.json`, `js/data/modelConstants/*`, `docs/models/klein/*` | Fabio's call on the Character Sheet replacement |
| MPI-612 | Garbage-collect the 15 pre-rename Klein style LoRAs (R2, HF, users' disks) | R2 / HF buckets, the orphan sweep | Nothing: it waited "two or three releases" after 1.5, and 2.0 has shipped |
| MPI-358 | Credit every shipped LoRA whose creator asks for it | `js/data/modelConstants/loraDeps.js`, credits surface | Nothing |
| MPI-533 | Tombstone ledger: a retired id survives its own removal | `js/data/modelConstants/*`, `docs/model-library.md` | Nothing |
| MPI-320 | installStore write-flip: retire `_modelJobs` / `_depJobs` | `routes/downloadManager.js`, `routes/install/installStore.js` | Deferred after 2.0 (MPI-513) |
| MPI-656 | Multiple model roots: install overflow across drives | `routes/modelRoots.js`, `routes/shared.js`, `routes/yamlHelper.js` | Nothing (MPI-654 and MPI-655 shipped 2026-08-29) |
| MPI-755 | Library headers show disk space used | Model / Flow Library header components | Nothing |

## Parallel Batch

Disjoint by file: MPI-358, MPI-656 and MPI-755 can run together. MPI-603, MPI-612 and MPI-533
all touch `js/data/modelConstants/*` and the dep entries, so run them one after another (never
delete a dep entry: the orphan sweep reads `DEPS`). MPI-320 owns the install routes alone.
