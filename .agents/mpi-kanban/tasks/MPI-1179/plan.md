# MPI-1179 plan - New Models to Test

Umbrella, Fabio 2026-10-18. A holding card for new models we have found and want to bench
and evaluate before deciding whether to wire them in. Each model is its own member card;
Fabio adds more as we investigate. A member that passes the bench becomes its own
`/mpi-add-model` card; one that fails closes with its findings.

## Members

| Phase | Card | Title |
|---|---|---|
| 1 | MPI-1180 | Bench MOSS-Image (5B text-to-image) once ComfyUI v0.42.0 ships |

**Umbrella rule: every new model card is added to this table with a phase, and its
`description` starts with the `UMBRELLA: MPI-1179 - New Models to Test` prefix.**

## Phases

Phases run in any order unless a member says otherwise: each is blocked only on its own
prerequisite (an engine release, a licence answer, a download).

### Phase 1 - MOSS-Image (MPI-1180)

Blocked on ComfyUI v0.42.0. Details on the card's `brief.md`.
