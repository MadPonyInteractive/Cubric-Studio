# Roadmap (DESIGN)

> Part of [README.md](README.md). Umbrella card MPI-1134. Post-2.1. Phase details and parallel
> batches live in the card's `plan.md`; this file is the order and the card map.

## How it ships — master, behind `dev_mode`, no branch (Fabio, 2026-10-13)

- Every phase merges to **master**; no feature branch. Bug fixes release from master any time.
- **Standalone pieces ship ungated**, each as its own release: model limits, last-frame grab,
  land-on-card route, card import for agents (MPI-1136), Elements additions.
- **Pieces that only work together stay behind `APP_CONFIG.dev_mode`**: Story card, Storyboard,
  Infinite Video Flow, Cosmo's story tools. Opening the gate is the release that ships it.
- A project holding a Story card must open cleanly in a build with the gate closed.

## Phase 0 — blockers (existing cards plus one new)

| Blocker | Card | Why it blocks |
|---|---|---|
| Singularity H3: base swap, its upscalers, draft resolution | **MPI-1135** (new) | Decides the character-shot model and the draft canvas |
| H3 video upscale / H3 refiner | MPI-688, MPI-477 | The upscale pass |
| Video detailer (SAM3 region) | MPI-557 | The detail pass |
| Elements library | MPI-815 | The cast |
| Mix workspace | MPI-917 (umbrella MPI-986) | Assembly |
| Character Sheet Flows | MPI-1091 | Character Elements (near done) |
| Prop Sheet, extended to vehicles | MPI-586 | Prop / vehicle / animal Elements |
| Multi-angle Flow | MPI-1039 | Location Angles (360 pano MPI-623 is the other route) |

## Phases

1. **Story data** — Story card kind, recipe + validator, connector/MCP routes, model limits the
   planner reads. No UI.
2. **Elements additions** — Location / Prop / Vehicle / Animal templates, Character Voice +
   personality fields, Angles + Ambience groups, sheet Flows save into an Element.
3. **Shot runner + Continue step** — run a shot from the Story; draft, upscale, detail, edit as
   history entries on the take card; the four join modes.
4. **Infinite Video Flow** — first user-visible piece; outputs a Story card.
5. **Cosmo as director** — story/scene/shot tools, prompt review, pass running. Plus **MPI-1136**
   (card import for Cosmo + MCP), small, can land any time.
6. **Storyboard workspace** — fully editable.
7. **Story → Mix** — auto-assembly, ambience from Elements, music via Stable Audio 3, export.

## Deferred

- Lip sync (MPI-538) — voice-by-reference replaces it.
- LTX face identity (MPI-1096) — LTX does not do character shots in this pipeline.
- A "series" object above projects — Elements carry identity; add only if episodes need more.
