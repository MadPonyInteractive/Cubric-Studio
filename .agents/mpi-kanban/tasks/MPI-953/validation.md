# MPI-953 Validation

## What shipped

**Gap 1 fixed — Flow set derived from real `FLOWS`:**
- `FLOW_SMOKE_CATALOG` deleted. `loadRegistry()` now imports `flowsRegistry.js` and exports
  `FLOWS`, `flowDepKey`, `getFlowDependencies`.
- `resolveFlowSmokeSet` rewritten to use `reg.FLOWS` (each flow's `.id` and `.operation`).
  Each entry now carries `requiredModelIds` (first model per slot, or arm model for byModel
  arm) and `flowDepIds` (dep ids from `getFlowDependencies`).

**Gap 2 fixed — Flow leg stages what flows need:**
- New export `flowInstallNeeds(reg, flowSet)` — resolves model list + dep entries + total GB.
- `main()`: computes `flowNeeds` after `flowSet`; adds `flowNeeds.gbTotal` to `ensureVolume`
  and `volumeFitVerdict`; after model-matrix installs: installs flow-required models not
  already in the set, then each flow's dep entries via `/comfy/models/download/start` with
  `modelId: 'flow:${flowId}'`.
- `printFlowPlan` updated: per-entry model ids + dep count; summary of new models, dep groups
  and volume GB added.

**`--plan --flows all` flow section (confirmed, no GPU rented):**
- 14 entries (13 flows + ltx-extend H3 arm), all workflow files resolve.
- Flow models to install: ltx-23-balanced, minimax-h3-ref2va, klein-9b, krea2.
- Dep groups: outpaint(1), voice-changer(3), chatter-box(12), stems(1), minimax-music(4), sound-and-music(3).
- **Flow install adds ~170.1 GB to the volume.**

## Verification

- `node --test tests/smoke-flows.test.cjs` — **28/28 pass** (was 18; +10 new tests).
  New tests: FLOWS-derived ids, requiredModelIds (default/byModel arm), flowDepIds, flowInstallNeeds GB.
- `npm test` — **2144/2144 pass, 0 fail**.
- `node scripts/smoke-workflows.mjs --plan --flows all` — prints full flow section above,
  "all 14 flow graph(s) resolve ✓", `--plan: nothing rented, nothing spent.`

## release:check gate

`checkSmokeEvidence()` gates on `counts.fail > 0` and engine version only. Flow FAILs block
as expected. Gate needs no changes for 2.0.

## Review fixes (session 56a78131, 2026-09-27)

- **The volume double-counted.** `flowInstallNeeds` added the full weight of every Flow model
  (ltx-23-balanced, minimax-h3-ref2va, klein-9b, krea2 are all matrix models) on top of
  `set.totalGb`, so `--flows all` sized, and billed, a volume for weights it would never hold.
  It now takes the matrix's `set.depIds` and counts only what the Flows ADD (union, shared
  weights once). Computed after the matrix set; test: everything present -> 0 GB, only the
  model deps present -> less than alone but > 0.
- The playbook still described the deleted hand-kept catalog, and listed a
  `smoke-fixtures/smoke-probe.png` that does not exist (image Flows use the matrix's own probe).
- Verified: Flow deps install exactly as the app does (`flowDepKey` = `flow:<id>` on
  `/comfy/models/download/start` with `{modelId, dependencies}`, as `MpiFlowLibrary.js:502` via
  `downloadService.start`). `--plan` returns before any call to the app on :3000.
- `tests/smoke-flows.test.cjs` 29/29; eslint clean; `--self-check` OK. `npm test` 2144 pass /
  1 fail: `tests/flow-defer-commit.test.cjs`, from the stacks session's uncommitted
  projectService/generationService edits, not this card.

## Still owed

The leg has never executed on a Pod: that happens in MPI-595 B1 (the 2.0 smoke), after MPI-591.

