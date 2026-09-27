# MPI-955 validation

Built as MPI-941 Phase 10 (session 575c1f1a, 2026-09-27).

## Root cause
`_promptModelFilter` in `MpiGroupHistoryBlock.js` gated video History on "has an i2v op" but passed every
image model through. A t2i-only model (`flux-schnell-cloud`, `supportedOps: ['t2i']`) left `_opOptions()`
empty, so `_shouldShowPromptBox()` was false and the PromptBox (Cue/Stop, model picker) never mounted.

## Fix
Image branch of `_promptModelFilter` = `_modelTakesImage` (any op that is not `isTextOnlyOp`). The existing
fallback (`installedModels[0]`) and every reader of `installedModels` inherit it.

## Evidence
- `tests/desktop/history-prompt-model.spec.js` (new): RED with the filter reverted (timed out waiting for
  `#prompt-box-mount .mpi-prompt-box`), GREEN with the fix. Re-run by the orchestrator: 1 passed.
- `tests/desktop/history-modes.spec.js`: passed. Worker also ran `media-picker-to-history`, `workspace-sweep`
  (10 tests pass), `npm run lint:components` exit 0, `npm test` 2145 pass / 0 fail.
- Live check by Fabio: pending (select a DeepInfra t2i-only model, open an image card's History; the prompt
  box shows with an image-taking model, Cue/Stop work).

**VERIFIED by Fabio (2026-09-27), screenshots, "Everything works".** (9.1) Klein 9B edit running, he typed "Can you please use krea": CANCELLING A GENERATION, "Cancelled, as you asked", then Krea 2 alone. (9.3) "I need this to be cropped to 8:5": STARTING GENERATION on the first call, no refusal (he then stopped it; his GPU was busy with another app). (10) History prompt box with Cue/Stop present. He ran none to the finish line (GPU in use elsewhere).
**Noticed, not actioned (Fabio: not bothered):** the agent told him the crop "runs right on the local file without needing the GPU". False: tools go through the engine queue. Its source is the tool notes saying "with no model" (`js/shell/agentToolOps.js`). Rewording costs tool-schema bytes (17,158 of 17,200).
