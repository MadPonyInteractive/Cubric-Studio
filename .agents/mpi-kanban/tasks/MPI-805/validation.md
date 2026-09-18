# MPI-805 — validation

## Why this exists (verified, not assumed)

- `git show ee034559 -- routes/comfy.js`: MPI-800 removed `reloadExtraPathsWhenReady(yamlPath)`
  and the `POST /mpi/reload-extra-paths` call, replacing them with the `restartNeeded` flag.
  Before that, a folder change applied live and said nothing.
- **Before this card** (at `ee034559`), `_restartEngine` in `js/shell/navigation.js` was reached
  only from `_syncRadial`, gated on `APP_CONFIG.dev_mode`. No other caller, so no shipped user
  could restart the engine. **That is no longer true, by design:** `e925c9fc` added
  `Events.on('engine:restart', () => _restartEngine())` at `js/shell/navigation.js:320`, ungated,
  which is what the new button fires. `_restartEngine` itself is now at line 347 — the original
  note said 340, which the same commit's 7 added lines shifted.

## The drag-drop path does NOT need a restart — verified

- `POST /comfy/import-model` (`routes/comfy.js:1065`) copies the dropped file into an already
  configured folder. `grep -c 'writeExtraModelPathsYaml|restartNeeded'` over the handler: **0**.
- `folder_paths.cached_filename_list_` (engine, `folder_paths.py:496`) compares
  `os.path.getmtime(folder)` against the cached value and drops the cache when it differs.
  Dropping a file changes the folder's mtime, so the new LoRA is picked up with no restart.
- A folder ADDED to the yaml is a different case: it is not in `folder_names_and_paths` at all
  until boot, which is exactly what the restart ask covers.

## Automated checks — PASSED

- `npm test` + `npm run test:desktop`: green in CI on **`e925c9fc`**, the commit that carries this
  card's code (`gh run list` -> conclusion `success`, 2026-09-18T10:02Z). CI does not run
  `lint:components`, so it was re-run locally at close-out: `eslint js/components/ --max-warnings=0`
  **clean**, 2026-09-18.

## Pending

- [ ] **Fabio's check in the app** — the ONE thing left on this card. Change a model folder, press
  **Restart engine** at the end of External Connections, and confirm the engine comes back; then
  press it once mid-generation and confirm the existing refusal toast. `**Verify mode:** user-ux`,
  so no agent evidence can substitute. Card stays in `doing` / `validating` until then.
