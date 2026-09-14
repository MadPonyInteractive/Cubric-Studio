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
