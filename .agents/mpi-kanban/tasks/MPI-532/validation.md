# MPI-532 Validation

## Phase 1 — server scan, validate, serve (2026-09-17, auto)

- `node --test tests/user-flows.test.cjs` → 10/10 pass: a valid package; unknown
  model/dep/plugin/injector ids; `minAppVersion` above the app; an `Input_*` with no node
  (media slot, dotted step field, modelParams key); an injector-consumed key exempt; graph
  rules; absolute paths; shape; every shipped Flow expressed as a package validates (bar the
  `byModel` op and baked absolute paths); unreadable/misnamed folders; `packageFilePath`
  refuses traversal; the routes list and serve and 404 `..%2F` / `..%5C`; the uninstall guard
  keeps a package-only dep and releases it on the package's own uninstall.
- `npm test` → exit 0, 1265 tests, 1264 pass, 0 fail, 1 skipped.
- `node scripts/validate-injection-rules.mjs comfy_workflows/flow_stems.json comfy_workflows/flow_drama_box.json`
  against the live engine → both ✓ (the CLI still runs after its checks moved to
  `services/injectionRules.js`); against a dead port → exit 2 "Cannot reach ComfyUI".
- `node --check server.js` → ok. Real boot is covered by phase 2's isolated-app check.

## Phase 2 — renderer registration (2026-09-17, auto)

- `node --test tests/user-flows.test.cjs` → 12/12 pass, adding: markup anywhere in the manifest
  rejects the package (placeholders and graph-bound values exempt); a loaded package resolves
  through getFlowById / getCommand / getFilePrefix (`flowTestFlow`, never the key) /
  getCommandMediaInputs / getUniversalWorkflow; a broken one is listed with its reason, its
  markup title falls back to the folder name, and it has no op; re-registering replaces.
- `npx playwright test --config=playwright.desktop.config.js tests/desktop/flow-packages.spec.js`
  (+ flow-library-filters, flow-library-skips-drawer, flows-tab-ring, flow-uninstall-button)
  → 8/8 pass on port 56289, the dev app on :3000 untouched. The new spec boots a real app on
  a profile seeded with two packages: both register, the graph fetches through
  `/comfy_workflows/user-flows/…`, the preview decodes (naturalWidth > 0) from
  `comfy_workflows/display/user-flows/…`, the broken tile carries `--unavailable`, its drawer
  reads "Can't run" + the reason with no footer buttons, 0 page errors, 0 console errors.
- `npm run lint` → exit 0. `npm test` → exit 0, 1267 tests, 1266 pass, 0 fail, 1 skipped.

## Phase 3 — install by drop (2026-09-17, auto half; user-ux half pending)

- `node --test tests/user-flows.test.cjs` → 13/13, adding install: a folder named anything lands
  under its manifest id and the source is copied not moved; a second install → exists, untouched;
  overwrite replaces the whole folder; a zipped folder with `__MACOSX` noise installs; invalid →
  reported, nothing written; a non-zip file and a zip with no manifest → invalid; a zip-slip entry
  → rejected, nothing escapes; staging always emptied.
- `tests/desktop/flow-packages.spec.js` → 2/2: a real overlay drop (webUtils path stubbed) shows
  the overlay on dragenter with the Flow wording, hides on drop, installs, the tile appears with no
  restart, "Flow added" toast; a second drop opens "Replace Flow", Replace re-installs, one tile;
  0 page errors, 0 console errors.
- A real PowerShell `Compress-Archive` (deflate) zip of a Stems copy installs via
  `installPackage` into a scratch root; a second call → exists.
- `npm run lint` exit 0; `npm test` exit 0, 1268 tests, 1267 pass, 0 fail, 1 skipped.
- **User-ux PASSED (Fabio, 2026-09-17):** dropped the Stems test package into his own app — the
  "Stems (package test)" tile appeared Ready with no restart, its drawer offered Open + Uninstall
  ("It worked fine"). Gap found: deleting the folder from disk left the tile until restart →
  Refresh button folded into this card.

## Refresh button (2026-09-17, session fe5850ff)

- `tests/user-flows.test.cjs` → 13/13; the renderer test now also proves a package whose folder is
  gone leaves `FLOWS`, `COMMANDS` and `UNIVERSAL_WORKFLOWS`, a package still on disk stays, built-in
  Flows are untouched, and a failed scan (HTTP 500) prunes nothing.
- `tests/desktop/flow-packages.spec.js` → 3/3; new spec: two packages seeded, drawer opened on one,
  its folder deleted and a third package copied in with the app running, Refresh clicked → spinner
  shown then cleared, drawer closed, tiles = Kept + New, registries agree; 0 page/console errors.
- `npm run lint` exit 0; `npm test` 1275 tests, 1274 pass, 0 fail, 1 skipped.
- **User-ux PASSED (Fabio, 2026-09-17):** re-dropped the Stems test package, deleted its folder, Refresh removed the tile; copied it back, Refresh showed it again ("both worked").
