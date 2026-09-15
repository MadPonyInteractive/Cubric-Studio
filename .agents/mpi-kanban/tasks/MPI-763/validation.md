# MPI-763 validation

All checks below ran 2026-09-15 on this card's working tree.

- `node --test` on `decimal-gb-units`, `disk-full-message`, `install-progress`,
  `local-disk-gate-partial`, `remote-disk-gate-unknown-state`, `download-retry`: 15/15 pass.
  The new `tests/decimal-gb-units.test.cjs` pins `formatBytes(55e9) === '55.0GB'`,
  `formatBytes(20 * 1024 ** 3) === '21.5GB'` and the server `_fmtGb(55e9) === '55.0 GB'`.
- `npm test` (full unit suite): 1041/1042. The one failure is
  `tests/local-disk-gate-partial.test.cjs` teardown, `ENOTEMPTY ... rmdir ...\mpi756-<pid>\diffusion_models`.
  It is not caused by this card: the test passed in the targeted run above, and rerun solo
  unchanged it failed 1 of 3. `test.after` removes the models root right after
  `cancelAllDownloads()` while the first test's let-through resume is still tearing down.
  That test came from MPI-756 (`c5e1fd51`). Filed as a follow-up, not fixed here.
- `npm run test:desktop -- tests/desktop/flow-uninstall-button.spec.js` (own port 59219, not the
  user's :3000): 1 passed. It renders the Flow uninstall confirm through the edited
  `MpiFlowLibrary`, so the new `formatBytes` import resolves in the renderer and the text
  matches the decimal figure.
- `node --check` on `routes/downloadManager.js` and `routes/engine.js`; `eslint` on the changed
  component, util and spec files: clean.

Not exercised by a test: the Model Manager plugin tile size and plugin uninstall confirm. Both
use `formatBytes` and `sizeToGb`, which that module already imported, and the module loads in
the desktop spec's app boot.
