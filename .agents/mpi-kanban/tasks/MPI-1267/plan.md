# MPI-1267 UMBRELLA: LTX 2.5 release

Created 2026-10-24 (Fabio, "LTX 2.5 model 10"). Everything that launches with LTX 2.5. **All of it is
dev-gated** until the release that carries LTX 2.5. That release is named by the model, NOT a version
number: bug-fix releases (2.1.4, 2.1.5, ...) may ship from master while this work is in progress, and
none of them removes a gate. Decision record: memory `project_keyframes_storyboard_ship_with_ltx25`.

## Members

| Card | What | Depends on |
|---|---|---|
| MPI-1266 | LTX 2.5 Stage 2: 2.5 in the existing LTX Flows, 2.5-only Flows, second download route (HF), `high` tier measure, Fabio's raw review + recipe validation, and finally `devOnly` off | - |
| MPI-1268 | Stacks: reorder members in the Stack workspace + right-click Create Sheet (numbered, stack order) | - |
| MPI-1231 | Storyboard Flow: idea + character/place pictures -> a stack of panel cards with intent lines as notes + the numbered overview. Users make their own videos from the panels | MPI-1268 (Create Sheet) |

**Left the umbrella 2026-10-24 (Fabio):** MPI-1191 Keyframes to Video. Too big for this release
("maybe more than a week"); the Storyboard ships alone and users animate its panels themselves. 1191
keeps its decided design and research and sits under MPI-1134 (Story). MPI-1266's scope item
"Keyframes to Video on 2.5" therefore leaves this release too.

## Phase order

1. **In parallel:** MPI-1266 (model + existing Flows) and MPI-1268 (stacks). Disjoint files; one
   writer at a time on `flowsRegistry.js` (MPI-1266's Flow swaps vs MPI-1231's new Flow).
2. **MPI-1231** once MPI-1268 ships (Create Sheet); its panel generation can start before.
3. **Release:** every member done; Storyboard Flow graphics; UNRELEASED entries (LTX 2.5 model,
   Storyboard, stack reorder + Create Sheet); then ALL gates come off in one change.

## Not in this umbrella

- Keyframes to Video (MPI-1191), Story card with sections, Storyboard Editor workspace, Infinite
  Video: MPI-1134 (Story umbrella), built later on top of MPI-1231's stack.
- Multi-angle Flow (MPI-1039): ships with MOSS Image, not here.

## Verification

**Verify mode:** user-ux

The umbrella closes when its last member does; its `validation.md` then records the release that
carried it and that every gate came off together.
