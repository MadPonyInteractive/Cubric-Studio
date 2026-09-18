# MPI-805 — validation

## Why this exists (verified, not assumed)

- `git show ee034559 -- routes/comfy.js`: MPI-800 removed `reloadExtraPathsWhenReady(yamlPath)`
  and the `POST /mpi/reload-extra-paths` call, replacing them with the `restartNeeded` flag.
  Before that, a folder change applied live and said nothing.
- `js/shell/navigation.js:340` `_restartEngine` is reached only from `_syncRadial`, which is
  gated on `APP_CONFIG.dev_mode`. No other caller, so no shipped user can restart the engine.

## The drag-drop path does NOT need a restart — verified

- `POST /comfy/import-model` (`routes/comfy.js:1065`) copies the dropped file into an already
  configured folder. `grep -c 'writeExtraModelPathsYaml|restartNeeded'` over the handler: **0**.
- `folder_paths.cached_filename_list_` (engine, `folder_paths.py:496`) compares
  `os.path.getmtime(folder)` against the cached value and drops the cache when it differs.
  Dropping a file changes the folder's mtime, so the new LoRA is picked up with no restart.
- A folder ADDED to the yaml is a different case: it is not in `folder_names_and_paths` at all
  until boot, which is exactly what the restart ask covers.

## Pending

- [ ] `npm test`, `lint:components`
- [ ] Fabio's check in the app
