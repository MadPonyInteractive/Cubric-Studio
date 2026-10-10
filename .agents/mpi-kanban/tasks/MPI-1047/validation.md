# MPI-1047 Validation

2026-10-10, worker in session 38894ae1, re-checked by the orchestrator.

- Root cause: the dirty-generated guard ran BEFORE the changed set was known, so it could
  not tell a template rebuild (orchestrate.py, global) from a plain raw conversion (one file).
- Fix: `blockingDirtyLines()` in `scripts/sync-raw-workflows.mjs`, called after the changed
  set: `--all` or a changed `_template` blocks on every dirty generated file (unchanged);
  a plain raw edit blocks only on its own output path.
- `node --test tests/sync-raw-workflows.test.cjs`: 12 pass, 0 fail (rerun by orchestrator).
- `npm test`: 3019 pass, 0 fail, 2 skipped (DeepInfra-key gated), after the whole batch.
- Not run against the real repo: peers own files under comfy_workflows/.
