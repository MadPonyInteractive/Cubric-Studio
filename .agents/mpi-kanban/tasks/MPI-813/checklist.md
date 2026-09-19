# MPI-813 — checklist

- [x] `tests/helpers/scratch.cjs`: `scratchDir(prefix)`, `scratchDirSync(prefix)`, `scratchPath(name)` under `<tmp>/cubric-tests/<pid>/`, swept by `process.on('exit')`
- [x] `tests/gif-frames.test.cjs` — `tmpProject`, `solidPng`, the `legacy-src-` mkdtemp
- [x] `tests/gif-cutout.test.cjs` — `tmpProject`
- [x] `tests/gif-make.test.cjs` — `tmpProject`, `solidPng`
- [x] `tests/gif-maker.test.cjs` — `tmpProject`
- [x] `tests/gif-transform.test.cjs` — `tmpProject`
- [x] `tests/agent-memory.test.cjs` — `mkdtempSync` call site
- [x] Six files pass together (45/0), and `gif-frames` + `gif-make` at `--test-concurrency=1` (13/0)
- [x] `%TEMP%` gains no new project-shaped folders across a run — 0, including on a run that throws
- [x] Full `npm test` green — 1352 tests, 1351 pass, 0 fail, 1 skipped
