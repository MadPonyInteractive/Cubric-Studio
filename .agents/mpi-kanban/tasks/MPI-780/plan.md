# MPI-780 — Paid Flows for 2.0 (umbrella)

Umbrella created 2026-09-16 at Fabio's request. Carries no code of its own. Decisions,
requirements and open questions: [brief.md](brief.md). Gate: MPI-595 Gate A.

## Members

| Id | What | Phase | Notes |
|---|---|---|---|
| MPI-532 | Community Flow packages: the `user_flows/` loader, manifest schema, validator | 1 | Keeps MPI-560 as its umbrella (the Flow track); this umbrella only ORDERS it. Retargeted from 1.6 to blocking 2.0. |
| MPI-781 | Package Head Swap and DramaBox, take them out of the app | 2 | Blocked on phase 1. |

## Phase 1 — the loader (MPI-532)

Read first: MPI-532's `task.json` and `tasks/MPI-560/plan.md` § "Phase 6: The 1.6 package
format". Its settled decisions stand (validator is developer experience, not security; the
node packs are never forked; "Flows", never "flow plugins").

Added by this umbrella, all from brief.md § Requirements:
- `user_flows/` lives outside the tree an update replaces, and moves with the 2.0 userData
  rename.
- The manifest can name an app-side injector, so Head Swap keeps its boxes
  (`headSwapInjector.js`, today keyed to the op `flowHeadSwap`).
- A package may only reference dep and model ids the app declares.

Done when: a package folder dropped into `user_flows/` appears in the Flow Library after a
restart, runs, and still appears after an in-place app update.

## Phase 2 — package the two Flows (MPI-781)

- Author `head-swap` and `drama-box` as packages in their own private repo, under their own
  licence (MPI-532: never inside the AGPL app repo).
- Remove both FlowDefs, their ops (the four registry files) and their workflow JSONs from
  the app. KEEP every dep entry and the `ComfyUI-MelodramaBox` pin (brief.md § Requirements).
- Prove each package installs, runs a real generation, and shows the Klein 9B licence gate
  (Head Swap).
- Hand Fabio the two folders for Gumroad, plus per-Flow VRAM numbers for the spec block.
- Copy: `docs/releases/UNRELEASED.md`, Flow descriptions, docs site, website.

Done when: a fresh app shows neither Flow, both packages work from `user_flows/`, and no
grep hit for the two ids survives outside the dep registries and the packages' own repo.

## Closing

This umbrella moves to done when MPI-781 does. Tick MPI-780 in MPI-595's Gate A then.
