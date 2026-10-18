# MPI-1179 plan - New Models to Test

Umbrella, Fabio 2026-10-18. A holding card for new models we have found and want to bench
and evaluate before deciding whether to wire them in. Each model is its own member card;
Fabio adds more as we investigate. A member that passes the bench becomes its own
`/mpi-add-model` card; one that fails closes with its findings.

## Members

| Phase | Card | Title |
|---|---|---|
| 1 | MPI-1180 | Bench MOSS-Image (5B text-to-image) once ComfyUI v0.42.0 ships |
| 2 | MPI-1181 | Bench FLUX.3 Klein (one card, Turbo button: distilled int8 / base int8, dev-gated) once the engine is on >= v0.41.0 |
| 3 | MPI-1182 | Bench Fish Audio Drama 3 (int8 experts in RAM, ComfyUI-Drama3 pack) once the engine is on >= v0.40 |
| 4 | MPI-1183 | Bench InfiniSplat v2 (multi-view feed-forward splat) on a 3D Scene path video, after 2.1 |
| 5 | MPI-1184 | Scope ATAS world memory on MiniMax-H3 (multi-shot, same place across shots); spike before any adapter |

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

### Phase 3 - Fish Audio Drama 3 (MPI-1182)

Blocked on the engine bump. The ComfyUI-Drama3 pack needs v0.40 at minimum (tested on v0.41), so
the v0.42.0 bump for phase 1 covers it; confirm the pack loads there. int8 file, our own Qwen3-ASR
0.6B for the transcript. Needs ~48 GB of system RAM. Details on the card's `brief.md`.

### Phase 4 - InfiniSplat v2 (MPI-1183)

Deferred past 2.1 (Fabio, 2026-10-18): the current 3D Scene works, and a newer model may solve
consistency and camera placement better. Candidate for the 3D Scene lift-back MPI-623 dropped.
Weigh it against the ATAS scoping write-up (MiniMax-H3) before picking it up. Weights are
non-commercial (DA3-Giant). Details on the card's `brief.md`.

### Phase 5 - ATAS on MiniMax-H3 (MPI-1184)

Parked (Fabio, 2026-10-18): not testing now, maybe never. The scoping write-up is done and lives in
the card's `research/atas-h3-scope.md`. Verdict: do not build the adapter. The first step, if it is
picked up, is the one-hour, about $1.50 spike on a 5090 Pod (does H3 reference-to-video follow a
point-cloud render?), and it needs Fabio's yes on the price. Pi3X weights are non-commercial.
Weigh it against phase 4. Details on the card's `brief.md`.
