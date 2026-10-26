# MPI-1267 UMBRELLA: LTX 2.5 release

Created 2026-10-24 (Fabio, "LTX 2.5 model 10"). Everything that launches with LTX 2.5. **All of it is
dev-gated** until the release that carries LTX 2.5. That release is named by the model, NOT a version
number: bug-fix releases (2.1.4, 2.1.5, ...) may ship from master while this work is in progress, and
none of them removes a gate. Decision record: memory `project_keyframes_storyboard_ship_with_ltx25`.

## Current State

- 2026-10-24 ("LTX 2.5 model 10"): umbrella made, members planned (MPI-1231 and MPI-1268 plans
  written, every pick taken by Fabio, Storyboard references are optional: zero or many). PAUSED: Fabio
  finishes FLUX.3 / Multi-angle for 2.1.3 first. NEXT: pick a first member - MPI-1268 (stack reorder,
  no gate, small) or MPI-1231 Phase 0 (planner + panel bench, local GPU, yes already given); MPI-1266
  can run beside either. Nothing built yet.
- 2026-10-24 (later, Fabio): PiD 1.5 (MPI-1185) joined from MPI-1179: an upgrade to the shipped PiD
  upscaler, benched old vs new, replaces it if it wins.
- 2026-10-26 ("Storyboard 24"): MPI-1231 Storyboard DONE (dev-gated; tile + hero shipped, release note
  held in UNRELEASED.md). Its last item, Cosmo + MCP running it, moved HERE as a release check below.

## Members

| Card | What | Depends on |
|---|---|---|
| MPI-1266 | LTX 2.5 Stage 2: 2.5 in the existing LTX Flows, 2.5-only Flows, second download route (HF), `high` tier measure, Fabio's raw review + recipe validation, and finally `devOnly` off | - |
| MPI-1268 | Stacks: reorder members in the Stack workspace + right-click Create Sheet (numbered, stack order). NOT gated (Fabio): ships in the next bug-fix release once it passes | - |
| MPI-1231 | Storyboard Flow: idea + character/place pictures -> a stack of panel cards with intent lines as notes + the numbered overview. Users make their own videos from the panels | MPI-1268 (Create Sheet) |
| MPI-1185 | PiD 1.5: an upgrade to the PiD upscaler we ship (`nvidia-pid`). Bench old vs new; if 1.5 wins it REPLACES the old one (Fabio expects it will). Joined 2026-10-24, from MPI-1179 | - |

**Left the umbrella 2026-10-24 (Fabio):** MPI-1191 Keyframes to Video. Too big for this release
("maybe more than a week"); the Storyboard ships alone and users animate its panels themselves. 1191
keeps its decided design and research and sits under MPI-1134 (Story). MPI-1266's scope item
"Keyframes to Video on 2.5" therefore leaves this release too.

## Phase order

1. **In parallel:** MPI-1266 (model + existing Flows) and MPI-1268 (stacks). Disjoint files; one
   writer at a time on `flowsRegistry.js` (MPI-1266's Flow swaps vs MPI-1231's new Flow).
   MPI-1185 (PiD 1.5) can run any time beside them; its bench touches no member's files, but its
   swap shares `models.js` with MPI-1266, one writer at a time.
2. **MPI-1231** once MPI-1268 ships (Create Sheet); its panel generation can start before.
3. **Release:** every member done; Storyboard Flow graphics; UNRELEASED entries (LTX 2.5 model,
   Storyboard, stack reorder + Create Sheet, PiD 1.5 if it replaced the old one); then ALL gates
   come off in one change.

## Release checks (each must pass before the gates come off)

- **Cosmo and MCP can run the Storyboard Flow** (Fabio, 2026-10-26). Today `agentOpens: 'run'` and
  `buildFlow` refuses it with `OPENS_FOR_USER` (agent, connector, routines), so neither can. Build it,
  then the live ask in words from Cosmo AND from an outside agent over MCP ("make me a storyboard
  of ..."): it picks Storyboard, plans, and a board lands as one stack. Then add its paragraph to
  `docs/agent/flows.md` (playbook 07; that file is at its 200-line cap) and a recipe in
  `.claude/skills/cubric-vision-flows/SKILL.md` if MCP needs a calling convention.
- **Fold the held release note**: `docs/releases/UNRELEASED.md` § "Held for the LTX 2.5 release"
  goes into the notes of the release that takes the gates off, never earlier.

## Not in this umbrella

- Keyframes to Video (MPI-1191), Story card with sections, Storyboard Editor workspace, Infinite
  Video: MPI-1134 (Story umbrella), built later on top of MPI-1231's stack.
- Multi-angle Flow (MPI-1039): ships with MOSS Image, not here.

## Verification

**Verify mode:** user-ux

The umbrella closes when its last member does; its `validation.md` then records the release that
carried it and that every gate came off together.
