# MPI-1046 - Remote-only users are offered ComfyUI in Remote > Language Models

Card description has the diagnosis. Ships with MPI-1045, which removed the plugin gate that
greyed ComfyUI here by accident.

## Current State

Done and verified (validation.md). Waits only to be committed together with MPI-1045, which is
blocked on one line in assetDeps.js held by the Qwen 2.1 implementation 3 session.

## Remaining Work

- [x] `MpiLlmSettings._init` reads `hasNoEngine()` (engineGate.js) once per open.
- [x] ComfyUI entry greyed for both rows (enhancement + descriptions) when there is no engine.
- [x] `_missing('comfy')` says the pick runs on Remote until an engine is installed or a Pod connected.

## Verification

**Verify mode:** auto

- `npx eslint` clean on MpiLlmSettings.js.
- Live: an isolated app with `runpodConfig.skipLocalEngine` on, no engine, no Pod -> ComfyUI greyed in both rows; with an engine -> enabled. If the isolated launch is not practical, record why.

## Plan Drift

- 2026-10-08: added the check to tests/desktop/no-engine-user.spec.js (the existing no-engine user spec) rather than an app:isolated run.

## Completed
