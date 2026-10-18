# MPI-1179 plan - New Models to Test

Umbrella, Fabio 2026-10-18. A holding card for new models we have found and want to bench
and evaluate before deciding whether to wire them in. Each model is its own member card;
Fabio adds more as we investigate. A member that passes the bench becomes its own
`/mpi-add-model` card; one that fails closes with its findings.

## Members

| Phase | Card | Title |
|---|---|---|
| 1 | MPI-1180 | Bench MOSS-Image (5B text-to-image) once ComfyUI v0.42.0 ships |
| 2 | MPI-1181 | Bench FLUX.3 Klein (Balanced distilled int8 + High base int8, dev-gated) once the engine is on >= v0.41.0 |

**Umbrella rule: every new model card is added to this table with a phase, and its
`description` starts with the `UMBRELLA: MPI-1179 - New Models to Test` prefix.**

## Phases

Phases run in any order unless a member says otherwise: each is blocked only on its own
prerequisite (an engine release, a licence answer, a download).

### Phase 1 - MOSS-Image (MPI-1180)

Blocked on ComfyUI v0.42.0. Details on the card's `brief.md`.

### Phase 2 - FLUX.3 Klein (MPI-1181)

Blocked on the engine bump. It needs v0.41.0 at minimum, so the v0.42.0 bump for phase 1 covers
both. Dev-gated, not a 2.1 item (Fabio, 2026-10-18). Details on the card's `brief.md`.

**Engine bump timing (Fabio, 2026-10-18):** do the bump BEFORE 2.1's full Pod smoke (MPI-1044) if
v0.42.0 is out by then. One bump and one full smoke then cover 2.1, and 2.2 brings both models with
no second bump.
