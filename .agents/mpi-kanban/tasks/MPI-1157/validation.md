# MPI-1157 validation

2026-10-16, session facd4d99:

- `node --test tests/uninstall-background.test.cjs` - pass (new). Real route over a stubbed
  wrapper with the first delete held open: the route answers `202 {success, started, modelId}`
  while the delete is still in flight, no `download:uninstalled` before the work ends, then the
  broadcast carries `removed[]`. A Pod that cannot be checked broadcasts
  `download:uninstall-failed` (`reason: wrapper-unreachable`) and never `download:uninstalled`.
  The LOCAL twin answers 202 and reports on the same broadcast. A malformed body is still a
  synchronous 400.
- `uninstall-inflight-race`, `remote-uninstall-reporting`, `uninstall-store-settle`,
  `uninstall-guards` - pass, moved to the new contract (await the run, not the response). The
  MPI-1142 per-dep in-flight re-check is untouched and its race test still passes.
- `npm test` - 3357 pass, 0 fail, 2 skipped.
- `npx playwright test --config=playwright.desktop.config.js tests/desktop/flow-uninstall-button.spec.js`
  - pass (stub now answers 202 and emits the result on the bus later).
- Live, `npm run app:isolated` (port 60154, never :3000), browser driven by playwright-cli:
  mounted MpiQueuePanel, called `downloadService.uninstall('boogu-edit-balanced', [2 weight deps],
  deleteFiles=false)` (keep-files, so nothing could be deleted). Transfers row
  "Uninstalling Boogu Image Edit", meta "Working", bar carrying `mpi-progress--loading` at 3 ms;
  the call resolved at 67 ms when the REAL stream's `download:uninstalled` arrived on the bus
  (removed 0, keptModelFiles 1); row gone afterwards.

Not live-checked: the renderer's `download:uninstall-failed` toast (no Pod to refuse); covered
server-side by the test above. A slow (Pod) uninstall was not run live; the held-delete test
proves the 202-before-work ordering.

## Closed 2026-10-16 (session facd4d99)

CI Tests green on fcd0f6570 (unit + 4 desktop shards), the commit carrying this code.
