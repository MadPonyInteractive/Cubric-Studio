# MPI-781 — Package Head Swap and DramaBox, take them out of the app

Phase 2 of umbrella **MPI-780** (Paid Flows for 2.0). The umbrella's plan
([tasks/MPI-780/plan.md](../MPI-780/plan.md) § Phase 2) and its decisions
([brief.md](../MPI-780/brief.md)) are the source; this file is the working plan.

**Gate:** MPI-595 Gate A. 2.0 does not ship until this closes or is dropped.
**Unblocked by:** MPI-532 (the `user_flows/` loader), closed 2026-09-18.

## Current State

**All four phases are done in the app repo and verified by what can be run here**
(`npm test` 1348/0 twice, both packages lint clean against the shipped engine, the ported
graph guards green, `release:check` unchanged from before the card). Evidence and every
deliberate exception: [validation.md](validation.md).

**Single next action: the live check, which is Fabio's.** Drop both package folders on the
Flow Library, run a real generation from each, and confirm Head Swap's Klein 9B licence gate
fires. **It cannot be done on this checkout** — both manifests declare
`compat.minAppVersion: 2.0.0` and the tree is 1.6.1, so the loader refuses them by design.
Either stamp 2.0 (MPI-708) first, or lower the floor in a scratch COPY of each folder and
restore it after. The 2.0.0 floor is correct for the shipping artifact; do not weaken it in
the repo.

Not blocking, still owed: the sibling-repo copy (docs site, website), and the Gumroad
products, VRAM numbers and terms, which are Fabio's alone.

Settled before the first edit:

- Packages live in **`C:/AI/Mpi/Cubric-Flows`** — a new local git repo, sibling to
  this one (Fabio, 2026-09-19). **No remote.** Pushing it anywhere is outward-facing
  and needs a separate go.
- `C:/AI/Mpi/flow-package-tests/head-swap-test/` is MPI-532's proof package and the
  working template for the manifest shape.
- Package format: [docs/flow-packages.md](../../../../docs/flow-packages.md),
  `cubric/flow-package/v1`.

## Phase 1 — author both packages

Two folders in `C:/AI/Mpi/Cubric-Flows`, each `flow.json` + `workflow.json` + preview
image + hero video, no code.

- Lift each FlowDef out of `js/data/flowsRegistry.js` (`head-swap` ~line 450,
  `drama-box` ~line 1789) and each op out of `js/data/commandRegistry.js` into the
  manifest's `flow` / `op` blocks. Drop the keys a package does not own (`id`,
  `operation`, `workflow`) and any key `docs/flow-packages.md` does not list.
- **`op.filePrefix` MUST be set explicitly** — `flowHeadSwap`, `flowDramaBox`. A
  built-in op carries none because its key is the prefix; a package without it gets a
  title-derived name (MPI-532's test package saved as `flowHeadSwapPackageTest_001.png`).
- Head Swap keeps its boxes through `"injector": "headSwap"` — the manifest names the
  app-side injector, so `headSwapInjector.js` STAYS in the app.
- `workflow.json` is the API-format graph, copied from `comfy_workflows/flow_head_swap.json`
  / `flow_drama_box.json`. Strip any absolute path out of a string widget.
- Preview assets copied from `comfy_workflows/display/flow-{head-swap,drama-box}.{webp,mp4}`.
- The one security rule: no `<`, `>`, `"` or backtick in any manifest string. Curly
  quotes instead.

**Verify:** `node scripts/lint-flow-package.mjs <folder>` passes for both.

## Phase 2 — strip both Flows from the app

- Remove the two FlowDefs (`js/data/flowsRegistry.js`), their ops
  (`js/data/commandRegistry.js`), their entries in `js/core/operationRegistry.js` +
  `operation_registry.json`, and their graph rows in
  `js/data/modelConstants/universal_workflows.js`.
- Delete `comfy_workflows/{,raw/}flow_head_swap.json`, `…flow_drama_box.json` and the
  four `comfy_workflows/display/` assets (they now ship inside the packages).
- **KEEP, untouched:** every dep entry (`assetDeps.js`, `nodesDeps.js`,
  `pluginsRegistry.js`) and the `ComfyUI-MelodramaBox` pin in
  `dev_configs/node_lock.json`. Deleting a dep entry strands the weight on users'
  disks forever — the orphan sweep reads `DEPS`.
- **KEEP:** `js/services/workflowInjectors/headSwapInjector.js` and its `index.js`
  registration. A package reaches it by name.

**Verify:** `npm run release:check` (or the registry sync check) passes; grep finds no
`flowHeadSwap` / `flowDramaBox` op definition left outside the dep registries.

## Phase 3 — repoint the fallout

21 test files name these ids. Most use them only as an example op (gallery specs,
media-picker, filename strings) and repoint to a surviving op; these assert the
built-in exists and need real work: `flow-uninstall-guard`, `connector-flow-dispatch`,
`connector-agent-tools`, `box-overflow`, `cue-all-eligibility`, `flow-result-compare`,
`declared-fields`.

`tests/desktop/flow-packages.spec.js` and `tests/box-overflow.test.cjs` are the two
that should now exercise the PACKAGED Flow rather than the built-in.

**Verify:** `npm test` green; the desktop Flow specs green.

## Phase 4 — copy, docs, handover

- `docs/releases/UNRELEASED.md` — its Flow list names every Flow as part of the app.
- Flow descriptions, the docs site, the website (sibling repos — read
  `.claude/rules/sibling-repos.md` first; Cubric Studio (Docs) has a hard no-push block).
- Hand Fabio the two folders for Gumroad.

**Fabio only, never measured by this card:** per-Flow VRAM numbers for the listing spec
block, the two Gumroad products, terms and refund policy.

## Verification

**Verify mode:** auto

Phases 2–4 are code and copy: tests close them. Phase 1's real proof is `user-ux` —
a package dropped into `user_flows/`, listed in the Flow Library, running a real
generation, with Klein 9B's licence gate firing on Head Swap. Stop for Fabio there.

Done when: a fresh app shows neither Flow, both packages work from `user_flows/`, and
no grep hit for the two ids survives outside the dep registries and the packages' repo.

## Completed

- **Phase 1** — `c:\AI\Mpi\Cubric-Flows` created (local git, no remote, commit `bf1c44c`)
  with `head-swap/` and `drama-box/`, each manifest + graph + preview + hero. Both lint
  clean against the engine on 48188. README, LICENCE (placeholder terms — Fabio's to write)
  and the ported graph guards (`checks.test.cjs`, 7 tests) alongside.
- **Phase 2** — both FlowDefs, both ops, both `universal_workflows` rows and all eight
  graph/display files removed. Op keys kept as `deprecated: true` in both registries. Every
  dep entry kept and commented.
- **Phase 3** — 10 unit-test files repointed or moved; `scribble-object` turned out to carry
  head-swap's exact shape (two required image slots, a box step with `overflow: allow`,
  `result.compare: image1`) and took over most fixtures. 3 desktop specs repointed too —
  `npm test` does not run those, so they would have gone red unnoticed.
- **Phase 4 (app repo)** — `UNRELEASED.md` Flow list, `docs/flow-packages.md`, and a banner
  on each of the two `existing-flows/` pages. Those pages were KEPT in place: four other
  docs cross-link them, and the authoring knowledge in them is still true.

## Plan Drift

- 2026-09-19 — plan written at pickup. MPI-781 had no plan of its own; MPI-780 § Phase 2
  was the only source.
- 2026-09-19 — the plan said "21 test files reference these ids". That was the raw grep;
  only **10** actually failed. Most of the rest name `flowHeadSwap_001.png` as a filename
  string, or use a local fixture object, and neither cares that the Flow left.
- 2026-09-19 — the plan did not anticipate that four guards would need a NEW HOME rather
  than a repoint: they assert on the graphs, which left with the Flows. They are now the
  package repo's own `checks.test.cjs`. Deleting them would have been the easy wrong answer.
- 2026-09-19 — `compat.minAppVersion: 2.0.0` makes phase 1's live proof impossible on this
  1.6.1 checkout. Not foreseen; it gates the card's close, not its code.
