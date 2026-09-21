# MPI-780 — Paid Flows for 2.0 (umbrella)

Umbrella created 2026-09-16 at Fabio's request. Carries no code of its own. Decisions,
requirements and open questions: [brief.md](brief.md). Gate: MPI-595 Gate A.

## Members

| Id | What | Phase | Notes |
|---|---|---|---|
| MPI-532 | Community Flow packages: the `user_flows/` loader, manifest schema, validator | 1 | Keeps MPI-560 as its umbrella (the Flow track); this umbrella only ORDERS it. Retargeted from 1.6 to blocking 2.0. |
| MPI-781 | Package Head Swap and DramaBox, take them out of the app | 2 | Blocked on phase 1. |
| MPI-872 | The `cubric.studio/flows/<id>` redirects — what the app's shipped Get-it buttons actually open | 3 | Website repo, not this one. Blocked on the two coded URLs from MadPony-Identity MPI-81 (Fabio-only). |

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


## Phase 3 — the redirects (MPI-872)

Added 2026-09-21. The app half shipped in MPI-831 phase 4 and advertises both Flows with a **Get it** button opening `https://cubric.studio/flows/<id>`. Those redirects do not exist, so **the buttons 404 on our own domain right now**.

The coded Gumroad URL is deliberately never in the app: the first-100-free offer code rides in that URL and Cubric-Vision is public AGPL, so a committed one could be spent to zero by people who never open the app. The redirect is therefore not a convenience — it is the mechanism.

Blocked on the two coded URLs, which only Fabio can make (Gumroad has no write API). The route can be built and tested against the plain product URLs first.

**Release-day order:** 2.0 published → redirects resolve → products published.

## Closing

This umbrella moves to done when MPI-781 does. Tick MPI-780 in MPI-595's Gate A then.
