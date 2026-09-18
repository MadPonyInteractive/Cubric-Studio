# MPI-810 — checklist

## Root cause (found 2026-09-18, after the card was written)

`buildServerEnv()` in `main.js` spread `process.env` and then **overwrote**
`APP_DOCUMENTS` with `app.getPath('documents')`. The three roots immediately below it
(`CUBRIC_ENGINE_ROOT`, `CUBRIC_MODELS_ROOT`, `CUBRIC_USER_DATA_ROOT`) all honour an
explicit env override; `APP_DOCUMENTS` alone did not.

So a desktop spec **could not** isolate its Documents folder however it launched, and
`getProjectsRoot()` / `getProjectPathsRegistryFile()` resolved to the developer's real
`<Documents>`. That is why every desktop run wrote a bare `%TEMP%` entry into the real
registry — not the specs' `folderPath` argument, which only made the entry *expensive*.

## Done

- [x] `main.js` — `APP_DOCUMENTS: process.env.APP_DOCUMENTS || documentsPath`, matching the
      three roots below it. One line; the root cause.
- [x] `tests/desktop/launch.js` — sets `env.APP_DOCUMENTS` to a per-test dir, the way it
      already isolates userData. Covers every spec using the helper, with no per-spec change.
- [x] The five gif desktop specs — `folderPath: os.tmpdir()` → `testInfo.outputPath('projects')`,
      so projects stop landing in the temp root. The now-orphaned `const os = require('os')`
      went with it in all five (two were CRLF and needed a second pass).

## Verified

Ran `tests/desktop/gif-make.spec.js` on its own port (59479; the dev app on 3000 untouched):

- Real `<Documents>/…/project-paths.json` — mtime unchanged at `14:09:22`, content
  byte-identical to the pre-run snapshot. **No registry write at all.** Before this fix the
  same spec added `C:/Users/Fabio/AppData/Local/Temp`.
- No `mpi770-*` project folder under `%TEMP%`.
- Spec passed (9.7s).

## REVERTED — the unit-fixture half is NOT done

Consolidating the six unit fixtures (`gif-frames`, `gif-cutout`, `gif-make`, `gif-maker`,
`gif-transform`, `agent-memory`) under one `<tmpdir>/cubric-tests/` root via a
`tests/helpers/scratch.cjs` helper was written, then **backed out** — it broke the suite:

| run | result |
|---|---|
| HEAD, six files together | 45 pass, 0 fail |
| with the helper, six together | 44 pass, 1 fail |
| with the helper, `--test-concurrency=1` | 44 pass, 1 fail — **not** a parallelism race |
| `gif-make` alone | 3 pass, 0 fail |
| `gif-frames` then `gif-make` | `gif-make.test.cjs:92` fails, `gif/make failed: .meta directory missing` |

Ruled out: the shared root being deleted (canary file survived a `gif-frames` run), and
leftover dirs in it (8 planted dummies did not reproduce it). So `gif-frames` leaves some
state that breaks a later `gif-make`, and the mechanism is not yet known.

Backed out rather than shipped because the cardinal rule applies: a fix whose failure
cannot be explained is not understood. The litter it targets is cosmetic — 1042 folders
swept by hand in seconds on 2026-09-18 — and nothing about it touches the registry, which
is the defect this card was filed for.

**Open question for Fabio:** split the fixture litter into its own card and close this one
on the registry fix, or keep MPI-810 open until the fixture consolidation lands?

## Not in scope

~95 other `os.tmpdir()` sites under `tests/` create plain scratch dirs, never projects, so
they neither reach the registry nor leave project-shaped litter. Touching 114 call sites for
this defect is not worth the diff.
