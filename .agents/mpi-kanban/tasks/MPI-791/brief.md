# MPI-791 brief

A user reported an empty Upscale Model dropdown (only "None") while running on RunPod.

## What the user's log shows

- The first engine install fired the universal-workflow deps (upscalers, SAM3, BiRefNet, RIFE,
  yolo, taesd) in parallel with the engine download. `startUniversalWorkflowInstall` logged
  `customRoot=null`, so every engine asset resolved into the DEFAULT models root.
- About nine minutes later, step 6 of `_runEngineDownload` wrote the root the user had picked
  (`extra_model_paths.yaml written with chosen root: ...`). From then on `getCustomRoot()`
  answers the chosen root.
- ComfyUI still loads those weights: `buildExtraModelPathsYaml` always emits the default root as
  a second `comfyui_default` block. That is why SAM3 masking works.
- `/comfy/list-files` walks only `customRoot || default` plus the user's extra folders, so it
  never sees the default root once a custom root exists. The Upscale dropdown reads that route.

## Root causes

1. `/comfy/list-files` does not mirror the YAML's search set (primary + default root).
2. `_resolveLocalModelPath` (remote auto-upload) mirrors list-files, so it has the same gap and
   the upload fails with "not found in your upscale_models folders".
3. The engine install resolves UW-dep destinations before the chosen root is persisted (the
   root's files live in the engine folder the install creates).
4. On a Pod, `remoteModelPresent` asks the wrapper, which checks only the volume. The two
   upscalers are baked into the image (`bakedOnPod`), so they read absent and the app tries
   to upload a local copy. A remote-only user has no local copy, so the dropdown is empty and
   a default-upscale generation (SDXL hires) fails the upload.

## Fixes

1. `getSearchedModelsRoots()` in `routes/shared.js`; list-files walks it.
2. `_resolveLocalModelPath` walks it too.
3. `_runEngineDownload` hands the chosen root to `checkUniversalWorkflowDepsStatus` and
   `startUniversalWorkflowInstall` explicitly.
4. `remoteModels.podBakedModelNames(type)`: list-files adds them when remote is active, and
   `remoteModelPresent` answers true for them without asking the wrapper.

## Constraints

- MPI-656 (multiple model roots) has UNCOMMITTED Phase 1 hunks in `routes/engine.js` and
  `routes/shared.js`. Commit only this card's hunks (index blob built from HEAD).
- Do not touch `_localSharedDepsMap` / `_orphanedDepIds` (MPI-656 constraint).
