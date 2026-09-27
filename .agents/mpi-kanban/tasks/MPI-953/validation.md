# MPI-953 Validation

> **REOPENED 2026-09-27 on review (session 56a78131). Not done.** (1) The Flow set comes from a hand-kept
> catalog on a false premise: `js/data/flowsRegistry.js` loads in bare Node. (2) The leg stages none of a
> Flow's `requiredModels` / `requiredDeps`, so `--flows all` would fail most Flows on a rented Pod.
> The evidence below is the first pass; the rework replaces it.


## What shipped

- `scripts/smoke-workflows.mjs` — Flow leg added: `resolveFlowSmokeSet`, `prepFlowOp`,
  `printFlowPlan`, `preflightFlows`, `stageProbeMedia`, `runFlowOp`. `--flows all` /
  `--flows <id,id>` selector, off by default. `FLOW_SMOKE_CATALOG` (13 entries). byModel arm
  expansion for `ltx-extend` → 14 entries on `--flows all`. UNIVERSAL_WORKFLOWS imported
  (no browser deps). `loadRegistry` updated. `main()` updated.

- `tests/smoke-flows.test.cjs` — 18 unit tests, all passing. No network, no Pod.
  Tests: resolveFlowSmokeSet (5), prepFlowOp (13). Covers: all-14 expansion, byModel arms,
  image/video/audio probe injection, SKIP on missing fixture, no-media flows,
  minimizeGraph applied.

- `dev_configs/smoke-fixtures/smoke-probe.mp4` — 1 s, 128×128, H.264, silent (1.5 KB).
- `dev_configs/smoke-fixtures/smoke-probe.wav` — 1 s, mono 22050 Hz, PCM silent (43 KB).

- `docs/playbooks/bump-engine/01-smoke-run.md` — new section "Running Flows — `--flows`"
  documenting usage, catalog, byModel arms, probe media table, evidence format,
  and when to run.

- `docs/playbooks/bump-engine/README.md` — checklist item added for `--flows all` when a
  Flow is added or changed.

## Verification

- `node scripts/smoke-workflows.mjs --self-check` passes.
- `node --test tests/smoke-flows.test.cjs` — 18/18 pass.
- `node --test tests/agent-loop.test.cjs tests/agent-tool-ops.test.cjs` — 143/143 pass
  (no regression).
- `node scripts/smoke-workflows.mjs --plan --flows all` — prints 14 flow entries, all
  workflow files resolve, "all 14 flow graph(s) resolve ✓", no GPU rented.

## release:check gate

`checkSmokeEvidence()` in `release-health-check.mjs` gates on `counts.fail > 0` and engine
version match only. It does NOT gate on Flow coverage. Flow results are additive — a run
without `--flows` is still accepted; flow FAILs block as expected. The gate does not need
changes for 2.0.
