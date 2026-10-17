# MPI-1109 validation

2026-10-17, session 56079a96:

- Online Describe (gallery `describeItem`, Cosmo `agent.describe`) now enqueues `imageDescribe`
  with `describeEndpoint`; it runs on the `cloud` lane through `js/services/describeExecutor.js`
  (one POST to `/llm/describe`, pulse, Stop aborts, every exit settles the store job). The
  ComfyUI describe path is unchanged; internal callers (child-safety look, kept-looks captions)
  stay unqueued (`describeImage` without `queued`).
- `npx playwright test --config=playwright.desktop.config.js tests/desktop/describe-queue-row.spec.js`
  - pass. Endpoint backend, `/llm/describe` held open: queue running rows = ['Describe Image'],
  store lanes = ['cloud']; on answer the caption reaches `workspace:inject-prompts` and both
  lists empty. Negative check: with `queued: false` in describeAction the same spec FAILS.
- `node --test` cloud-executor, flow-describe, generation-batch-queue, lane-agreement,
  lane-settle-on-bail, llm-describe, mask-track-queue, snapshot-preserves-queued,
  child-safety-gate: 121/121. Every test naming a describe path (9 files): 334 pass, 0 fail.
  `tests/cloud-executor.test.cjs` factory regex updated for the new head.
- `npx eslint` on the 5 touched js files + the spec: clean.

- Fabio's eye test, 2026-10-17, his own instance (online describer): Cue shows a running
  "Describe Image" row with Stop ("1 running / 0 queued"), status bar running. "Verified."

## Closed 2026-10-17 (session 56079a96)

Master Tests green on fd92f31ca (run 39034448786), the commit carrying this code. Eye-tested by Fabio.
