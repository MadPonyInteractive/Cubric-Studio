# MPI-751 Validation

Progress check for every fix: `npx eslint -c .agents/mpi-kanban/tasks/MPI-751/rule/tier.eslint.config.cjs js/ -f json`
(runs only the parked rule; count its `no-same-tier-component-import` messages). `npm run lint` must stay at 0.

## Fixes 1 + 2 (5a51434c) — 27 -> 22 hits

Lint clean, npm test 972/972, desktop gallery-audio-waveform / flow-audio-player / gallery-archive /
gallery-cue-all 11/11.

## Fix 7 (2026-09-14, option a) — 22 -> 20 hits

`MpiMediaPicker` no longer imports `MpiAudioRecorder` / `MpiVoicePicker`. It takes `recordAudio` and
`voicePicker` props; the mic card needs `recordAudio`, the voice card also needs `voicePicker`.
`MpiBaseFlow` is the only consumer that opens an audio picker (`MpiPromptBox` and
`MpiToolOptionsPlace` open image pickers only), so it is the only one passing them.
`toWavFile` moved to `js/utils/toWavFile.js` (not `wavEncoder.js`, which stays import-free for bare-Node tests).

- `npm run lint`: 0
- `npm test`: 991/991 (baseline before the change: 991/991)
- `npx playwright test --config=playwright.desktop.config.js tests/desktop/media-picker-cards.spec.js tests/desktop/flow-audio-player.spec.js`: 10/10,
  including the new check "the mic and voice cards render only when the slot hands their components in"
  (fails on the old code: an audio picker without props rendered the mic card)
- Parked rule: 20 hits; no `MpiMediaPicker` hit left

## Fix 6 (2026-09-14) — 20 -> 19 hits

`js/components/Compounds/MpiModelSettings/loraSlotParts.js` -> `js/components/loraSlotParts.js`, beside
`shaderBackground.js`: no tier folder, imports Primitives only, consumed by two Compounds.

- `npm run lint`: 0
- `npm test`: 991/991
- `npx playwright test --config=playwright.desktop.config.js tests/desktop/flow-lora-button.spec.js tests/desktop/model-settings-popup.spec.js`: 3/3
- Parked rule: 19 hits; no `MpiLoraRack` hit left
- Not touched: `js/components/Compounds/MpiGalleryToolbar/filterPanel.js:4` still names the old path in a
  comment. The file is under MPI-749's live claim, so its owner was messaged instead.

## Fixes 5 + 9 (2026-09-15, session 088b3125) — 19 -> 17 hits

- Fix 5: `Compounds/MpiCompareOverlay` -> `Organisms/` (it composes Compound `MpiCompareView`). Importers:
  `MpiGalleryBlock.js`, `MpiGroupHistoryBlock.js`, `js/pages/components.js`.
- Fix 9: `Primitives/MpiMaskedImagePreview` -> `Compounds/` (it composes Primitive `MpiCanvas`'s
  `ViewManager`). Importer: `MpiCanvasViewer.js`.
- Both: `preloadStyles.js` renamed in place (keeps cascade order), `types.js` typedef comments, header
  tier words, rule maps (`component-mounts.md` header; the `MpiCompareOverlay` events entry moved from
  `component-events-primitives.md` to `component-events-organisms.md`).
- Trap: each component also names its own stylesheet in `ComponentFactory` `css: [...]`. Lint and
  `npm test` stayed green with the OLD folder there; only a repo-wide grep for the old path caught it.
  Grep the old path after any tier move, not just `import` lines.

- `npm run lint`: 0 (plus eslint on all 7 touched files after the css fix)
- `npm test`: 1016/1016
- `npx playwright test --config=playwright.desktop.config.js tests/desktop/mask-persist-roundtrip.spec.js`: 3/3
  (prompt-mode preview mounts from the new path)
- Parked rule: 17 hits; no `MpiCompareOverlay` / `MpiMaskedImagePreview` hit left
- No spec opens the compare overlay: visual check in Fabio's app pending
