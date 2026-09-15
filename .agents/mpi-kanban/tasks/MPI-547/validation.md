# MPI-547 Validation

## Phases 1-4 (2026-09-14) — worker session 144809aa, verified independently by the orchestrator

Changed: `js/data/generationControls.js` (new, the one resolver), `js/shell/agentDispatch.js`
(`_plannedSize` removed), `routes/connector.js` (named params + static validation, named error codes),
`js/services/generationService.js` (explicit `seed` threaded), `PromptBoxControls.js` (`_resolveDefault` and
both tier resolves delegate to the module), `tests/connector-named-params.test.cjs` (new, 22 tests),
`.claude/skills/cubric-vision/SKILL.md`, `docs/generation-lifecycle.md`.

- Diff scope: `git diff --numstat` shows only the owned files; `ratios.js` and both snapshot tests untouched
- `npm run lint`: 0
- `node --test tests/connector-named-params.test.cjs`: 22/22 (krea2 1k + 2k and LTX dims unchanged by the
  extraction; one invalid-value path per param; turbo:true leaves the project deep-equal)
- `npm test`: 1015/1015 (peer cards added tests since the 991 baseline)
- Full desktop suite (`npx playwright test --config=playwright.desktop.config.js`): 67/69. The app booted on
  every spec, which proves `routes/connector.js` can `require()` the ESM module on Electron 41 / Node 24.
  The two failures do not reach these files: `media-picker-cards` "one tile per card" passed on rerun
  (MPI-749 changed the gallery sort shape mid-run, 83715ebe); `gallery-audio-waveform` fails on the
  played-half tint, imports only MpiGalleryGrid, and was reported to MPI-749.
- Injection keys checked against the controls: `Width`/`Height`/`Ratio_Label`, `Input_is_Turbo`,
  `Input_Style_Selector.selector` / `.strength_model`, `Input_Batch_Size`. Ranges match the pickers
  (stylization 0..1, batch 1..4). `commandExecutor` still randomises an absent seed.

## Phase 5 — live smoke (2026-09-15, session 088b3125, Fabio's app, project "547")

Run 1, code as of cab50e53, under `gpu_lease.py run`: `krea2` t2i, `ratio:"9:16"`, `qualityTier:"2k"`,
`turbo:true`, `seed:12345`. The project was fresh (`shared` empty, krea2 saved at `1k`, no turbo), so
ratio AND tier both differ from what the project would have used.

- `ok:true`, `generationMs` 76181, `pixelDimensions` 1088x1936.
- PNG IHDR read off disk: 1088x1936 = krea2 9:16 at 2k (`resolveRatioDimensions`).
- Sidecar `generationSettings.injectionParams`: Width 1088, Height 1936, Ratio_Label 9:16,
  `Input_is_Turbo: true`; `controlState` 2k + `krea2Turbo: true`.
- Comfy `/history` (:48188) dispatched graph: node 503 `MpiInt` `Input_Seed` = 12345. The seed reached the sampler.
- `project.json` `shared` and `modelSettings`: deep-equal before/after (only `sequenceCounters` was added).
- Placeholder card: Fabio watched it in the gallery, latents streaming into the running card.
- **FAIL: sidecar `seed: -1`.** See the seed finding below.

### Finding: the seed was never recorded, and a caller's `Seed` was dropped (since b07a30cc, v1.1.0)

b07a30cc (2026-07-11, "make Input_*/Output_* the single naming law") renamed `Seed` to `Input_Seed` in
`commandExecutor._buildParams` and left two readers behind. `exec.seed = params.Seed` reads a key the
bare-key alias loop always deletes, so every sidecar records -1 (851 of 948 sidecars on this box). And
that loop fills `Input_Seed` only when absent, while `_buildParams` already set it to a random seed, so
`injectionParams.Seed` from Reuse (`promptReuse.js:126`) and the frozen preview seed
(`MpiGalleryBlock.js:649/815`) was deleted and a random seed ran. Fix: `_buildParams` resolves
`injectionParams.Seed ?? seed ?? random`; `exec.seed = params.Input_Seed`. Source-text checks in
`tests/seed-uint32-range.test.cjs`: 2 new, red before the fix, 4/4 after. `npm test` 1016/1016.

### Batch change (Fabio, 2026-09-15): agents never batch

`batch` removed from the named params. `resolveNamedParams` pins `Input_Batch_Size` to 1 on any model
that batches (only SDXL today); the route refuses a `batch` field with `BATCH_UNSUPPORTED`. Tests: 2
replaced batch tests, red before the change (route answered 200, resolver returned 3), 21/21 after.
Lint clean on all touched files. `npm test` 1014/1014 after the batch change.

Run 2 (after Fabio restarted the app, project 547):

- Live batch refusal: `sdxl-realistic` t2i with `batch:2` -> HTTP 400 `BATCH_UNSUPPORTED`, nothing dispatched.
- Same krea2 submit with `seed:67890` (a new seed, so Comfy could not serve it from cache): `ok:true`,
  API `seed` 67890 (run 1: -1), PNG IHDR 1088x1936, **sidecar `seed` 67890**, `Input_is_Turbo` true,
  Comfy `/history` node 503 `Input_Seed` 67890. `project.json` `shared`/`modelSettings` deep-equal before/after.
- Fabio's screenshot: both runs in the gallery as 9:16 cards, visibly different images for the two seeds.

**Phase 5 PASS.** Verify mode user-ux: Fabio watched the placeholder card and latents live.
