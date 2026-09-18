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

## Phase 4 (2026-09-17, session fe5850ff)

- `docs/flow-packages.md` (163 lines) written; linked from `docs/README.md` and
  `docs/playbooks/add-flow/README.md`.
- `scripts/lint-flow-package.mjs`: the Stems test package → exit 0; a copy with a wrong folder name
  and a `NoSuchNodeClass` node → exit 1 naming both (class check against :8188); with
  `COMFY_URL=http://127.0.0.1:1` → only the folder error, plus "node classes NOT checked"; no args → exit 2.
- Head Swap packaged as `head-swap-test` (scratch only, script `pack-headswap.cjs`): the two baked
  author paths (nodes 79/81 `string`) cleared; linter exit 0 with every node class checked against
  the app engine (:48188).
- `tests/user-flows.test.cjs` → 14/14: new "installed packages survive an app update" (userFlowsDir
  under APP_USER_DATA, main.js portable userData = `<root>/user-data` handed to the fork, PRESERVE
  keeps `user-data/`).
- `tests/desktop/flow-packages.spec.js` → 4/4: new spec packages the shipped Head Swap on a fresh
  profile; the package is valid, its licences equal the built-in (klein-9b among them, none accepted),
  and its drawer shows the same licence rows and the same footer buttons as the built-in drawer.
- `npm run lint` exit 0; `npm test` 1305 tests, 1304 pass, 0 fail, 1 skipped.
- Real generation from the package: NOT yet run (needs Fabio's app).
- **Drop-time validation seen in the real app (Fabio, 2026-09-18):** the first Head Swap package
  was built in the session scratchpad, which Windows swept overnight (00:50) — the .webp/.mp4 went,
  the JSONs stayed. Dropping it raised exactly `flow.preview: "flow-head-swap.webp" is not in the
  package folder.` and `user_flows/` was left untouched (no `.staging` residue). Rebuilt durably at
  `C:\AI\Mpi\flow-package-tests\head-swap-test`; linter exit 0 against the app engine (:48188).
  **Never build a test package under %TEMP%.**

## Real generation from a package — PASSED (Fabio, 2026-09-18)

Fabio dropped `C:\AI\Mpi\flow-package-tests\head-swap-test` on the Flow Library inside a project
("Head Swap (package test) is in your Flows", 11 installed) and ran it on two images with both
boxes drawn.

- Sidecar `Media/.meta/3a1420cf-….json` (project "New Project"): `operation: "user:head-swap-test"`,
  `injectionParams.box1 {x:-619,y:556,1299x1299}` / `box2 {x:-183,y:185,1176x1176}`, two media items
  (roles image1/image2 from `.preview-assets`), seed 2322314888.
- The file landed as `Media/flowHeadSwapPackageTest_001.png` — the title-derived `filePrefix`
  default, no colon, beside the built-in `flowHeadSwap_001.png`.
- ComfyUI `:48188/history` job `d89361c6` (status success) carries `Input_Box` and `Input_Box_2`
  with those exact numbers: the boxes did not merely arrive, the headSwap injector applied them
  through a PACKAGE op. Three other jobs in history are `execution_interrupted` (Fabio cancelled a
  second run) — no failure.

## Gallery drop overlay stranding (folded in 2026-09-18, Fabio hit it twice)

- Repro: in a project, open the Flow Library, drop a Flow folder, return to the Gallery — the media
  import overlay covers it and only leaving the project clears it.
- Root cause: `_dragCounter` is zeroed by a BUBBLE-phase `drop` on window, but every drop overlay
  calls `stopPropagation()`, so a drop landing on an overlay never reset it. Fixed at all three call
  sites (`MpiGalleryBlock`, `MpiGroupHistoryBlock`, `js/shell/projectUI.js`) by listening in the
  CAPTURE phase; the matching `removeEventListener` carries the same flag or the listener outlives
  the block.
- `tests/desktop/gallery-drop-overlay-reset.spec.js` 2/2, and both RED before the fix (reverting the
  gallery flag alone: stuck overlay true, later hide false).
- `tests/desktop/flow-packages.spec.js` `until()` raised 5s -> 15s: its first drop failed once while a
  real generation was running on this box. Not a regression — with the capture fix reverted it still
  failed, and both files are 6/6 together now.
