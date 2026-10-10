# MPI-1068 Validation

2026-10-10, worker in session 38894ae1, re-checked by the orchestrator.

- Root cause: `set.scope` is built at PLAN time, before any op SKIPs, and was written to the
  evidence unchanged.
- Fix: `postRunScope(set, results)` in `scripts/smoke-workflows.mjs`, applied after every
  result is in: a model with no PASS/FAIL op leaves `modelsRun` for `unproven`, with the
  siblings it covered unless an executed model covers them. Merge semantics unchanged.
- `node --test tests/smoke-scope-skipped.test.cjs`: 7 pass, 0 fail (rerun by orchestrator).
- Existing smoke + engine-drift tests: 68 pass. `npm test`: 3019 pass, 0 fail.
- `dev_configs/smoke-evidence.json` not regenerated (a Pod run costs money): the corrected
  scope appears from the next smoke run. release:check only WARNS on unproven.
