# MPI-810 — validation

Closed 2026-09-18 on the registry fix. The fixture-litter half was split to [[MPI-813]]
at Fabio's call, with its failed attempt and evidence carried over.

## What shipped

`main.js` — `buildServerEnv()` now reads `APP_DOCUMENTS: process.env.APP_DOCUMENTS || documentsPath`.
It previously overwrote the value unconditionally, while the three roots immediately below
it (`CUBRIC_ENGINE_ROOT`, `CUBRIC_MODELS_ROOT`, `CUBRIC_USER_DATA_ROOT`) all honoured an
explicit override. That one asymmetry is the whole defect: no spec could point the app at a
different Documents folder, so `getProjectsRoot()` and `getProjectPathsRegistryFile()`
always resolved to the developer's real `<Documents>`.

`tests/desktop/launch.js` — sets `env.APP_DOCUMENTS` to `testInfo.outputPath('documents')`,
mirroring the existing per-test `userData` isolation.

The five gif desktop specs — `folderPath: os.tmpdir()` → `testInfo.outputPath('projects')`,
plus the `const os = require('os')` each one no longer used. Two of the five are CRLF and
needed a second pass; the first edit silently missed them.

## Evidence

`npx playwright test --config=playwright.desktop.config.js tests/desktop/gif-make.spec.js`
with `--output` into a scratch dir. The run took its own port (59479) and left the dev app
on 3000 alone.

- **Passed**, 9.7s.
- Real `<Documents>/Cubric Vision/project-paths.json`: mtime `14:09:22` before **and**
  after, content byte-identical to the pre-run snapshot (`diff` clean). The spec opens a
  project, so before this fix that same run added `C:/Users/Fabio/AppData/Local/Temp` to it.
- No `mpi770-*` folder under `%TEMP%` afterwards — the project landed in the test's own
  output dir.

## Honest limits

- Not proved RED by a committed regression test. `main.js` requires `electron` at line 1
  and exports nothing, so `buildServerEnv` cannot be required from a `node --test` file;
  testing it would mean extracting it to a module, a bigger change than the one-line fix
  warrants. The before/after registry comparison above is the evidence instead, and it is
  a real run, not a reasoned argument.
- The 12 desktop specs that do **not** use `launchApp` still launch Electron themselves and
  so do not get `APP_DOCUMENTS`. None of them open a project by a caller-supplied
  `folderPath`, so none reaches the registry today — but a new one that did would leak
  again. If that becomes a risk, the isolation belongs in `globalSetup.js`, not the helper.
- `%TEMP%` was still registered in the real registry when this closed. The fix stops it
  being re-added; clearing the existing entry is Fabio's, through the app.
