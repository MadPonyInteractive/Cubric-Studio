# MPI-1045 - Deprecate the Image Describer plugin

Audit: `research/audit.md`. Fabio 2026-10-08: plugin goes; Qwen3-VL-4B
(`qwen3vl-abliterated-clip`) becomes an engine dependency, installed with ComfyUI.

## Current State

Complete and verified (validation.md). Commits together with MPI-1046 (same MpiLlmSettings.js).
Next action: close-out (mpi-end-session) - commit by pathspec, push, move both cards to done.

## Remaining Work

- [x] `assetDeps.js`: `engineAsset: true` on `qwen3vl-abliterated-clip` + comment. **Held by MPI-936's live claim** - message 8a39bdab asks them to make it or release.
- [x] `pluginsRegistry.js`: delete the `image-describer` entry; fix header/`upscale` comments naming it.
- [x] `llmService.describeImage`: drop the plugin check (DESCRIBER_MISSING); keep the `model` provenance string.
- [x] `describeAction.js`: drop the DESCRIBER_MISSING branch.
- [x] `MpiLlmSettings.js`: drop `_comfyInstalled` gate, disabled meta and `_missing` note.
- [x] `generationService.js`: Cue prompt line for a text op falls back to the op label.
- [x] Comments: `commandRegistry.js`, `universal_workflows.js`, `agentDispatch.js`, `routes/connector.js`, `notificationService.js`.
- [x] Tests: `llm-service` (no DESCRIBER_MISSING), `plugin-dep-gc` + `shared-dep-uninstall-direction` re-targeted, `remote-engine-assets` asserts the weight is an engineAsset.
- [x] Docs: llm.md, plugins.md, toasts.md, agent-chat.md, krea2 README, generate SKILL.md, rule `component-events-primitives.md` (Fabio OK'd).

## Verification

**Verify mode:** auto

- `node tests/llm-service.test.cjs`, `tests/plugin-dep-gc.test.cjs`, `tests/shared-dep-uninstall-direction.test.cjs`, `tests/remote-engine-assets.test.cjs`, `tests/job-display-name.test.cjs`, `tests/scene-convert.test.cjs`, `tests/flow-uninstall-guard.test.cjs`, `tests/universal-nodes-remote.test.cjs` pass.
- `npm run lint` clean on touched files.
- `grep -rn "image-describer\|DESCRIBER_MISSING" js routes services tests docs .claude` -> history notes only.

## Plan Drift

- 2026-10-08: also fixed stale comments in flowsRegistry.js, llmEngines.mjs, song.md and the E2E spec `llm-settings-remote.spec.js` (it asserted the old greyed text).

## Completed
