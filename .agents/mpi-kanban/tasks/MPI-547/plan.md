# MPI-547 Plan — named parameters for `generation.submit`

## Goal (Fabio's words, 2026-08-12)

> "I restart the app and I'll ask the agent for a specific generation with specific
> settings and a specific model, and the agent will be able to do that."

The agent must be able to SET what the PromptBox exposes — ratio, resolution, turbo,
quality tier, style, batch — per generation. **The UI does not need to reflect it.**
An agent submit is not a UI action; having it rewrite the user's prompt box mid-session
would be worse than the gap.

## Where MPI-546 left it

`POST /connector/generate` works and lands a real gallery card. What it cannot do:

- Only `modelId`, `operation`, `positive`, `negative`, `injectionParams` are accepted.
- Everything else is inherited from whatever the open project is set to.
- `injectionParams` DOES pass straight through to the graph, and caller values already
  win over the resolved ratio — so `{"Width":1024,"Height":1024}` works TODAY. The gap
  is the friendly layer above it.

`js/shell/agentDispatch.js` `_plannedSize()` already resolves the saved ratio via
`getSharedSettings` + `getModelRatios` and injects `Width`/`Height`. That is the seam
this card generalises — read it first, it is the worked example.

## Why this is not just "add a few fields"

The PromptBox controls are **not** raw injection keys. `js/components/Organisms/
MpiPromptBox/PromptBoxControls.js` `PROMPT_BOX_CONTROLS` declares **22** of them:

```
qualityTier, ratio, previewStage, audioMode, useAudio, batch, duration,
motionIntensity, useGrid, upscaleFactor, denoise, pidVariant, refImageSize,
pidResolution, qwenTier, krea2Turbo, h3Turbo, styleSelect, stylization,
controlType, controlStrength, enhancePrompt
```

Each carries a `scope` (`shared` / `perModel` / `perOp`) and most resolve through model-
specific tables before becoming injection params. Two that bite:

- **`ratio`** is a LABEL (`"9:16"`), and the pixels depend on the model's table AND the
  quality tier — `getModelRatios(model.type, orientation, qualityTier)`. `krea2` 1k vs
  2k are entirely different pixel sets.
- **`qualityTier`** lives in the SHARED bucket, not per-model. A stale `qualityTier`
  ALSO sits inside `modelSettings[id]` on real projects; reading it there sizes off the
  wrong tier. (Documented at `js/data/projectModel.js` § `getModelSettings`.)

## The decision that shapes the work

**Do NOT reimplement the resolvers in `agentDispatch`.** A second copy of the
ratio/tier logic drifts the moment a model's table changes — that is precisely the
class of bug MPI-546 shipped three times (see its validation.md). Extract the
resolution so the PromptBox and the agent path share ONE implementation.

Note `generationService.js` already imports `resolveControlDefaults` FROM
`MpiPromptBox/PromptBoxControls.js` — a service reaching into a component. Extending
that coupling is the wrong direction; the extraction should move the resolver toward
`js/data/` or `js/utils/`, leaving the component as a consumer.

## Locked decisions

1. **Per-generation, no persistence.** A submit must NOT write the project's saved
   settings. An agent quietly flipping turbo on, followed by a manual Cue inheriting
   it, is a nasty surprise. Unset params keep falling back to the project's state,
   exactly as today.
2. **No UI reflection.** The PromptBox does not re-render to match. Confirmed by Fabio.
3. **Named params, not raw keys.** `{"ratio":"9:16","quality":"2k","turbo":true}`, not
   `Input_Width`. Raw `injectionParams` stays as the escape hatch and keeps winning.

## Open question for the session that picks this up

**ANSWERED (Fabio, 2026-09-14): v1 = the recommended list below** — `ratio`, `qualityTier`,
`krea2Turbo`/`h3Turbo`, `styleSelect`, `stylization`, `batch`, plus an explicit `seed`.
Nothing else from the 22.

**Which of the 22 controls are in scope for v1?** Recommend the ones Fabio named plus
the obvious neighbours: `ratio`, `qualityTier`, `krea2Turbo`/`h3Turbo`, `styleSelect`,
`stylization`, `batch`, and an explicit `seed`. The video-only and op-specific ones
(`duration`, `motionIntensity`, `useGrid`, `denoise`, `controlType`…) can wait for a
real need. Confirm with Fabio before building — do not silently do all 22.

## Phases

### Phase 1: Extract the resolver
Move ratio/tier resolution into a shared module both the PromptBox and `agentDispatch`
call. No behaviour change.
**Verify:** existing tests still green; a manual Cue still produces the same size.

### Phase 2: Named params on the route
Accept the v1 set in `POST /connector/generate`, validate them (an unknown ratio label
must be a NAMED error, not a silent fallback), resolve through Phase 1, merge into
`injectionParams` with caller-supplied raw keys still winning.
**Verify:** unit tests per param, incl. the invalid-value paths.

### Phase 3: Per-model + turbo settings
`krea2Turbo` / `styleSelect` / `stylization` are `perModel` scope, so they are settings
rather than injection. Apply them for the run WITHOUT persisting (decision 1).
**Verify:** submit with `turbo:true`, then confirm `project.json` modelSettings is
UNCHANGED.

### Phase 4: Docs
Update `.claude/skills/cubric-vision/SKILL.md` § "Dispatching a generation" with the
parameter table and error codes.
**Verify:** re-read; no stale "inherits the project's settings" claim.

### Phase 5: Live smoke
**This is not optional and the API response does not prove it.** MPI-546 returned
`ok:true` through three separate real bugs (duplicate dispatch, invisible run, ignored
ratio). Watch the actual app.
**Verify:** submit with an explicit ratio + turbo; confirm the OUTPUT pixels match the
request, the placeholder card matches, and `project.json` settings did not change.

## Verification

**Verify mode:** user-ux — the failures here are visual and the API cannot see them.

## Plan Drift

- 2026-09-14: **The qualityTier "trap" above is stale, and the code it described was the bug.** The
  mounted `qualityTier` and `ratio` controls read `modelSettings[id].qualityTier` FIRST (per-model since
  MPI-133) and use `shared.ratioSelector.qualityTier` only as the pre-SCHEMA-4 fallback; `getModelSettings`
  no longer documents the tier at all. MPI-546's `_plannedSize` did the reverse, so an agent submit could
  size off a different tier than the one the PromptBox shows. `js/data/generationControls.js`
  `resolveEffectiveQualityTier` now uses the UI's precedence for all three callers.
- 2026-09-14: **Unset turbo/style/stylization/batch now follow the project.** Before, an agent submit
  injected only Width/Height, so those ran at the workflow's baked values while the sidecar recorded the
  project's. Decision #1 ("unset params fall back to the project's state") is now literally true, which
  also means a project saved at batch 3 batches an unnamed agent submit 3 times. Raised with Fabio.
- 2026-09-15: **Fabio: agents never batch.** A batch of N holds N latents in VRAM at once; N queued
  submits hold one. `batch` is out of the named params, agent runs pin `Input_Batch_Size` to 1, and a
  `batch` field is a named error (`BATCH_UNSUPPORTED`). Supersedes the batch half of the bullet above.
- 2026-09-15: **Phase 5 found a seed bug older than this card** (b07a30cc, shipped v1.1.0): sidecars
  record -1 and a caller's `injectionParams.Seed` is dropped for a random one. Same primitive as the
  `seed` param, so fixed here in `commandExecutor._buildParams`. Detail in validation.md.

## Inherited traps (read before starting)

- `.agents/mpi-kanban/tasks/MPI-546/validation.md` — all three bugs and how each hid.
- The workflow bakes its own size: `krea2_t2i_sfw.json` nodes `74`/`75`
  (`Input_Height` 1344 / `Input_Width` 768). Inject nothing and THAT wins, silently.
- Sidecars record no `Width`/`Height` when nothing was injected, so "what size did it
  actually use" is not answerable after the fact from the sidecar alone.
- One renderer only when smoking: a job goes to the NEWEST subscriber, so a stray dev
  browser tab steals it from the Electron window.

## Current State

ALL PHASES DONE (2026-09-15). Phase 5 PASS on run 2 after the batch change and the seed fix: sidecar
seed recorded, batch refused live, pixels/turbo/tier/project.json all pass, Fabio saw the placeholder.
Nothing remains but closing the card. Ownership: `files.json`. The MPI-546 square-1024 note is moot:
run 1 proved an explicit non-default ratio and tier land in the pixels.
