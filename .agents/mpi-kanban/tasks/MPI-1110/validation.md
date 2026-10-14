# MPI-1110 validation

2026-10-12, session 2001b3f5:

- `js/shell/projectUI.js` `_showCleanupConfirm`: the `/project/cleanup-assets` request runs inside
  `runCpuJob('Cleaning up <project>')` (MPI-1104), so from the confirm until the server answers the
  user sees the right-edge flash (MPI-1105) and a Transfers row with the sweep. End states
  unchanged: "Cleanup complete" toast, or "Cleanup failed" warning (the row leaves either way).
- `npx playwright test --config=playwright.desktop.config.js tests/desktop/cleanup-assets-row.spec.js`
  - pass. Real UI path: right-click a landing row -> "Cleanup assets…" -> Cleanup. The project is
  created in a scratch `APP_DOCUMENTS`, and the route is stubbed in the page so the job is held
  open: row "Cleaning up Cleanup Probe" present, flash visible; on answer the row goes and
  "Removed 3 cached assets." shows.
- Same run: `queue-flash.spec.js`, `cpu-job-row.spec.js` now also use a scratch `APP_DOCUMENTS`
  (they had listed the user's real projects; read-only, but no reason to) - 3 pass.
- `npx eslint js/shell/projectUI.js` - clean.

## Closed 2026-10-14 (session 3d712bc0)

Agent-verifiable check only (specs above passed); master Tests green on 8ef55aa7a, which carries this code. Owning session closed; moved to done per kanban.md "validating is not a parking space".
