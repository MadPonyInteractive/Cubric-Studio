# MPI-915 validation

**Shipped:** a `folder` ghost button beside Refresh in the Flow Library search row opens
`user_flows/` in the OS file browser, through the existing `POST /open-folder` (Electron
`shell.openPath`). `GET /user-flows` now answers `dir` alongside `flows`, and
`userFlowService` keeps it for the button. Fabio picked the spot: next to Refresh, so it is
there whatever the filters hide.

## Evidence (2026-09-25)

- `node --test tests/user-flows.test.cjs` - 14/14 pass; the routes test pins `dir` equal to
  `userFlowsDir()`.
- `npx playwright test --config=playwright.desktop.config.js tests/desktop/flow-packages.spec.js`
  - 5/5 pass on the suite's own port (49220). The new test boots a real app, clicks the button,
  intercepts `/open-folder` (a real one would pop Explorer on the runner) and asserts the
  posted `folderPath` is the profile's `user_flows/`. No page or console errors.
- `npx eslint` on the four changed source/spec files - clean.

Not checked by an agent: how the icon sits visually beside Refresh.
