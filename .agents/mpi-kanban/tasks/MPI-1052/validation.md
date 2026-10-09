# MPI-1052 validation

## Cause

`prefetchInstalledModels` counted `ids.length`. Since MPI-918 the installed set holds every cloud (DeepInfra) model when a key is saved, and those resolve no files to stage. Live 2026-10-09: "staging 18 models" with 3 models on the volume (MPI-1051 test).

## Fix

Count a model only when `_hotStoreFiles` returns files for it; the toast and the log line both use that count.

## Evidence (2026-10-09)

- `node --test tests/pod-identity-hot-store.test.cjs` -> 9/9 pass. New test: `klein-4b` + two cloud models -> "staging 1 model".
- Bite check: with the toast back on `ids.length` the new test fails; restored, it passes.
- `npx eslint` on both files: clean.
