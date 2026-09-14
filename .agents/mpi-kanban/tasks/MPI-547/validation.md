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

## Phase 5 — live smoke (not run)

Needs the real app restarted (the route is server-side), then a submit with explicit ratio + turbo + seed.
