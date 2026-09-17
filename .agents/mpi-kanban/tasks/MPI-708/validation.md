# MPI-708 validation

## Phase 0 / 0b

Met 2026-09-17 (session 53d9d605): `gh release view v1.5.0` is published; the `v1.5.0` tag's
updaters match `^Cubric(Vision|Studio)-...-update-v.*\.zip$` and `apply-update.cjs` accepts
`cubric.vision` and `cubric.studio`. See plan.md Plan Drift.

## Phase 1 — PASSED 2026-09-17 (session ad10647f)

Renames done by Fabio in GitHub Settings (the auto-mode classifier refused `gh repo rename`).

1. **Hub rename.** `gh repo view MadPonyInteractive/Cubric-Connector` -> private hub. The old
   `Cubric-Studio` slug is now the product repo (name reused, so the hub's redirect is gone by
   design); hub remote set to `Cubric-Connector.git` first, `git fetch` OK. Hub `98310e0`
   (headings), repo description updated.
2. **Product rename.** `gh repo view MadPonyInteractive/Cubric-Studio` -> public product;
   `gh repo view .../Cubric-Vision` resolves to `Cubric-Studio`. `git remote -v` here shows
   `Cubric-Studio.git`; `git fetch` and `ls-remote` OK. Old slug:
   `curl -sI https://api.github.com/repos/MadPonyInteractive/Cubric-Vision/releases/latest` ->
   `301` to `/repositories/1197467902/releases/latest`; followed, it returns v1.5.0 with
   `CubricVision-windows-x64-v1.5.0.zip`. `github.com/.../Cubric-Vision/releases/latest` -> `301`
   to `.../Cubric-Studio/releases/latest`.
3. **CI auth gate.** mpi-ci `e23112e` accepts both slugs; Vision `c0972475` dispatches
   `source_repo=MadPonyInteractive/Cubric-Studio`. `gh workflow run build-portable.yml` ->
   dispatcher run `35222050796` success -> mpi-ci run `35222060391`: "Checkout source" = success
   on linux, macos and windows. Log (ubuntu job `105204381139`): `repository:
   MadPonyInteractive/Cubric-Studio`, `ssh-key: ***`, `git remote add origin
   git@github.com:MadPonyInteractive/Cubric-Studio.git`, fetch OK -> the deploy-key path was taken.
   Run cancelled after checkout (conclusion `cancelled`, 0 artifacts) to save Actions storage.
4. **Pointer sweep.** `MadPonyInteractive/Cubric-Vision` -> `Cubric-Studio` in MadPony-Identity
   `eb0ee38` (6 files, slugs only), ComfyUi-MpiNodes README (carried by a peer's pushed commit
   `060e78c`; HEAD line 7 reads the new slug), Vision `c0972475` (8 files). Deliberately left:
   `feature-request-tier-label.md:73` (already correct post-rename), code slugs owned by later
   tasks (redirect-safe), the Website repo (Fabio's; its links and API fetch keep working through
   the redirect, measured on `denoland/deno_std`).
5. **README** (Fabio's request): "formerly Cubric-Vision" note at the top; mascot image and its
   orphaned `.github/readme/mascot-greet.png` removed (`c0972475`).

## Parallel Batch (partial: 2 of 5) — PASSED 2026-09-17 (session ad10647f)

Two workers, disjoint ownership, orchestrator-reviewed diffs.

- **Heal the Documents folder** (`routes/shared.js`, `tests/documents-heal.test.cjs`): one
  memoized, lazy resolver `_getDocumentsFolder()` behind `getProjectsRoot()` and
  `getProjectPathsRegistryFile()`; heal only when the app major is >= 2 (package.json, test seam
  `CUBRIC_TEST_APP_VERSION`); failed rename -> warn + old folder. No other runtime reader of the
  Documents folder exists (grep of main.js, server.js, routes/, services/, scripts/).
  `node --test tests/documents-heal.test.cjs` 7/7 (old-only v2 rename + registry rewrite, new-only,
  both, neither v1/v2, old-only v1 no rename, EBUSY fallback);
  `tests/fork-shutdown.test.cjs` + `tests/model-roots.test.cjs` 26/26 (require stays side-effect free).
- **Build identity**: `productName` (package.json, electron-builder.yml) -> Cubric Studio;
  `exeName` -> `CubricStudio.exe`; root/update archive names -> `CubricStudio-*`; macOS bundle and
  manifest `displayName` -> Cubric Studio; updater `DEFAULT_REPO` (win/linux/macos) ->
  `MadPonyInteractive/Cubric-Studio`; `PRESERVE` gains the Cubric Studio Documents paths;
  `RETIRED_PATHS.win32` gains `CubricVision.exe` (inert, see plan drift); `appId` and package
  `name` unchanged; every both-names bridge fallback kept.
  Portable tests (`portable-win-layout`, `portable-update-apply`, `portable-dry-run-isolation`,
  `updater-rename-bridge`) pass; `npm run build:portable:dry-run` succeeded, manifest `appId`
  `cubric.vision`, `displayName` `Cubric Studio` (dry-run stages no binaries).
- Orchestrator re-run: the six targeted test files 28/28; `npm test` 1287 pass, 0 fail, 1 skipped.

## Parallel Batch (remaining 3 of 5) — PASSED 2026-09-17 (session 0408510a)

- Ownership narrowed to exact files (claim `ac7d298e`); three files held by live peers left for a later pass.
- Main process: `main.js` (error-box title, exe comment, updater API slug + User-Agent), `routes/engine.js:52`, `routes/remotePodState.js:153`, `routes/system.js:323` `ISSUE_REPO` + `tests/issue-report-url.test.cjs:86`. `app.setName('Cubric Vision')` kept (D3a). `issue-report-url` 5/5. eslint clean on touched JS.
- Docs: 20 of 28 owned files changed; kept lines are real paths (dev `%APPDATA%\Cubric Vision`, pre-2.0 Documents), local folders (D4), the RunPod template name, and dated history. `PROJECT.md:83` + `project-integrity.md` describe the 2.x name plus the automatic rename. Release docs name `CubricStudio-*` assets plus the 2.0-only legacy dual-publish; "1.5.1 bridge" corrected to 1.5.0 (checked: `v1.5.0` updaters match `^Cubric(Vision|Studio)-`).
- Tooling: 21 files. `mpi-release` upload globs and tag annotation now `CubricStudio-*` / `Cubric Studio v<ver>`; `mpi-version-bump` header template `# Cubric Studio vX.Y.Z`; no script parses that header. Skill folder names and `name:` unchanged; cubric-vision* descriptions say "Cubric Studio (formerly Cubric Vision)". The four `.github` YAML files parse (PyYAML).
- Decision (c) recorded on the `RETIRED_PATHS` comment in `scripts/build-portable.mjs` (comment only).
- `npm test`: 1306 pass, 4 fail, 1 skipped. All 4 failures are in `tests/workflow-media-slots.test.cjs`, an UNTRACKED in-flight MPI-800 test (claim `8a806506`) that fails on that session's own uncommitted `comfy_workflows/raw/` edits; the main-process worker's earlier run, before that file appeared, was 1303/0.
