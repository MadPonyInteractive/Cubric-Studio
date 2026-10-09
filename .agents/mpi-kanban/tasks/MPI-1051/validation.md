# MPI-1051 validation

## What changed

- `js/services/commandExecutor.js` — `prefetchInstalledModels(ids)` takes an optional id list; the default (every installed model) keeps the connect path identical.
- `js/services/downloadService.js` — the model-level `download:complete`, after `reSyncInstalledModels()` and past the silent-job return, calls `prefetchInstalledModels([data.modelId])` (dynamic import, as shell.js does).

Guards are the existing ones: toggle off, local engine, CPU download-mode Pod -> nothing posted. Silent jobs (drift heal, engine-asset heal, an already-installed re-verify) never reach the call.

## Evidence (2026-10-09)

- `node --test tests/pod-identity-hot-store.test.cjs tests/install-queue-wedge.test.cjs tests/download-mode-pod-guards.test.cjs` -> 18/18 pass.
- New test `an install complete stages just that model, and only with the toggle on`: with `klein-4b` + `klein-9b` installed, `prefetchInstalledModels(['klein-4b'])` posts exactly klein-4b's files; toggle off posts nothing; a source-read pins the downloadService call after the silent return.
- Bite check: with the `ids` param ignored and the call reverted to `prefetchInstalledModels()`, the new test FAILS ("the installed model only, not every model on the volume"); restored, it passes.
- `npx eslint` on both files: clean.

## Not checked

- Live on a RunPod GPU Pod (costs money). What to look for the next time a model installs while a GPU Pod is connected: the toast "Warming the cloud engine — staging 1 model to fast disk in the background…" and the `app.log` line `hot-store: stage-on-connect queued N/M file(s) for 1 model(s)`.
- Doc line for `docs/runpod-remote-engine.md` § Prefetch: peer MPI-1050 holds the file; sent as message `cc67cfc4`.
