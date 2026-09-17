# MPI-656 Validation

**Verify mode:** user-ux (plan § Verification). Phase 1 verifies automatically.

## 2026-09-16 - Phase 1 dispatched

Board batch from session d58ac006 (Fabio: "dispatch minus 715"). One worker owns Phase 1:
`routes/modelRoots.js` (new), `routes/shared.js`, `routes/yamlHelper.js`,
`tests/model-roots.test.cjs` (new). Evidence lands below when the worker reports.

## 2026-09-16 - Phase 1 landed, NOT COMMITTED (worker + integrator, session d58ac006)

Worker: `routes/modelRoots.js` (new: getRoots/setRoots/findExisting/findAllCopies/
pickWriteRoot/ownerRoot, injectable roots), `getCustomRoot()` reads `model_roots.json` first and
seeds it from the YAML `base_path` on a yaml-only install, `writeExtraModelPathsYaml()` writes the
JSON too, `buildExtraModelPathsYaml()` accepts a string or an array.

Integrator fixes (orchestrator review):
- The worker stored the DEFAULT root as `[]`, so `getCustomRoot()` returned null where it used
  to return the YAML's default base_path (`/comfy/get-path` `isDefault` would flip, and the
  migration path stored `[default]` - two shapes for one state). Now the root is always stored
  as itself: Phase 1 changes no behaviour.
- `routes/engine.js` `_runEngineDownload` wrote the YAML directly (two sites), which would leave
  `model_roots.json` stale and WINNING after an install with a chosen root. Both now call
  `writeExtraModelPathsYaml()`; the orphaned `buildExtraModelPathsYaml` / `getExtraModelFolders`
  imports went with them. The worker's message 49926aff is resolved.

| Check | Command | Result |
|---|---|---|
| Module + migration + byte identity | `node --test tests/model-roots.test.cjs` | 22/22 (worker 21 + one integrator test: JSON equals the YAML base_path for two custom roots and the default) |
| Bite (worker) | `ownerRoot` always null | 5 red, restored |
| Bite (integrator) | default root stored as `[]` again | the new test red, restored |
| Guards | `tests/extra-model-folders`, `dep-path-agreement`, `partial-install-strands-weights` | green inside the full run |
| Full node suite | `node --test "tests/*.test.cjs"` | 1213 pass, 0 fail, 1 skipped |
| engine.js loads | `node -e "require('./routes/engine.js')"` | ok |
| `routes/downloadManager.js` | untouched (`_localSharedDepsMap` / `_orphanedDepIds` rule) | confirmed by `git status` |

Note: `model_roots.json` lives in the ComfyUI folder beside the YAML. The desktop specs boot the
server from this tree, so the repo's dev engine
(`engine/ComfyUI_windows_portable/ComfyUI/model_roots.json`) got seeded at 14:57 with
`G:/CubricModels`, equal to its YAML: harmless, and old code never reads it.
