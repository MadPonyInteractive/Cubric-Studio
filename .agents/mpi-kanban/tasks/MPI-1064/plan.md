# MPI-1064 Plan - Qwen-Image 2.1 umbrella

Fabio, 2026-10-10: everything related to or affecting Qwen-Image 2.1 (shipped on master by
MPI-936, releases in 2.0.2) is tracked here. Fabio tested the model on RunPod by hand on
2026-10-10, so its own Pod smoke is not a member.

## Members

| Card | Title | Kind |
|---|---|---|
| MPI-1049 | Transparent background toggle in the Prompt Box (Qwen-Image 2.1) | feature + agent guide |
| MPI-1047 | Raw-workflow sync refuses whenever any generated workflow is dirty | dev tool, hit twice on the Qwen build |
| MPI-1065 | Adding a dep to an installed model silently un-installs it | user-facing bug, found on Qwen's taeqi21 decoder |
| MPI-1066 | Upscale crosshatch on skin and cloth, traced to 4x-NMKD-Siax | research, then a default change |
| MPI-1067 | MpiAnySwitch selects the Nth CONNECTED input | node pack, no user impact today |
| MPI-1068 | Smoke scope counts an all-skipped model as RUN | release tooling |

## Related, not owned

- **MPI-1044** (release 2.0.2 umbrella): Qwen 2.1 reaches users there. Its Pod-runtime promote
  matters to Qwen: the 2.1 ControlNet lives in `model_patches`, which only the dev runtime
  carries (published 2026-10-10 by MPI-1057), so `control` produces nothing on a stable Pod
  until `promote`.
- **MPI-1043** (engine bump): closed 2026-10-10; its release leftovers were already MPI-1044's.

## Phase 1 - parallel batch (disjoint files)

MPI-1049 runs in the orchestrator session (session 38894ae1) beside the batch, on disjoint files:
`js/data/modelConstants/models.js` (Qwen 2.1 entry), `js/data/modelConstants/modelPriority.js`,
`js/data/generationControls.js`, the Prompt Box settings popover, `js/shell/agentDispatch.js`,
`docs/agent/models/qwen-image-2.1.md`, `js/data/recipes/qwen-image-2.1.recipe.js`, its tests.
Verify: user-ux, Fabio's eye on t2i + edit, alpha measured on the saved card.

## Parallel Batch

- [x] **MPI-1047** - raw-workflow sync refuses on any dirty generated workflow.
  Ownership: `scripts/sync-raw-workflows.mjs`, `tests/sync-raw-workflows.test.cjs` (new).
  **Verify:** new test proves a plain raw edit converts beside an unrelated dirty generated
  file, and a template edit still refuses; `npm test` green.
- [x] **MPI-1068** - smoke scope counts an all-skipped model as run.
  Ownership: `scripts/smoke-workflows.mjs`, `tests/smoke-scope-skipped.test.cjs` (new).
  Do NOT rewrite `dev_configs/smoke-evidence.json` (re-proving costs a Pod run).
  **Verify:** new test: a model whose every op skipped lands in `unproven`, not `modelsRun`;
  existing `tests/smoke-*.test.cjs` green.
- [x] **MPI-1067** - MpiAnySwitch selects by position, not by input name.
  Ownership: `C:/AI/Mpi/ComfyUi-MpiNodes/switches.py` and a test in that repo. No commit, no
  pin: the pin moves at close-out (`/mpi-nodes-sync`: committed, pushed, pinned).
  **Verify:** a test calling the node with a gapped input set picks `any_N` by name; every
  switch class sharing the code path covered.

## Phase 2 - after Phase 1 frees the shared files

- **MPI-1066** - research first: side by side on one Qwen 2.1 card (Siax alone, Qwen upscale,
  another upscaler), Fabio's eye; GPU work runs under the lease. Then
  `js/data/modelConstants/models.js` `defaultUpscale` (shared with MPI-1049, hence Phase 2).
- **MPI-1065** - ownership: `routes/comfy.js`, `routes/remoteModels.js`,
  `js/data/modelRegistry.js`. `routes/remoteModels.js` is claimed by MPI-1057 (live) as of
  2026-10-10: wait for its release.

## Done when

Every member is done or explicitly parked by Fabio.

## Current State (2026-10-10, session 38894ae1, handoff f02b4755)

- Phase 1 DONE in code, verified: MPI-1049 No Background (Fabio's eye-test passed on t2i, edit,
  Cosmo both routes, Enhance warning; numbers in its validation.md), MPI-1047, MPI-1068, MPI-1067.
  Vision side committed in the handoff commit; npm test 3022/0 before it.
- MPI-1067 is committed LOCALLY in ComfyUi-MpiNodes only: still to push and pin
  (`dev_configs/node_lock.json`, /mpi-nodes-sync). MPI-623 also moves that pin: check its claim.
- Cards stay in doing (1049/1047/1068/1067 validating): close each once CI is green on the commit.
- Phase 2 not started: MPI-1066 (crosshatch side-by-side, GPU lease, Fabio's eye), MPI-1065
  (routes/remoteModels.js was claimed by live MPI-1057).

## Plan Drift

- MPI-1049 grew two fixes from the eye-test: the No Background rule lives in the enhancer's SYSTEM
  prompt (a user-message note lost to the recipe's "brief is fixed" rule), and the Enhance dialog
  warns when an enhancement's No Background state no longer matches the toggle.
