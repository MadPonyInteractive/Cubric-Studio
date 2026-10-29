# MPI-1325 validation

**Root cause.** `MpiPromptBox._openMediaPicker` handed the voice library and the recorder to the
picker only for a REQUIRED audio slot (`_voiceSlot()`), which only Chatterbox Text to Speech has.
LTX and MiniMax H3 take audio through an optional slot, so their `+` opened a plain reference
picker. The picker also gated both cards on `slotType === 'audio'`, and a video model's `+` opens
on images.

**Fix.** The box passes `voiceRoute` + `voicePicker` + `recordAudio` whenever the `+` can add audio
(slot's own `voiceLibrary`, else `'character'`); the picker gates the Voice library and Record cards
on `slotTypes.includes('audio')`. Fabio 2026-10-29: Record on every audio-taking `+`, for
consistency (a first cut left it on voice slots only; reopened from `done` before the close landed).

**Evidence (2026-10-29).**
- `tests/desktop/media-picker-slot-types.spec.js` — real prompt box in the Electron app: LTX and H3
  `+` show Voice library AND Record; SDXL shows neither. Pass.
- `tests/desktop/media-picker-cards.spec.js` — mixed image+audio slot renders both cards; all 5 pass
  (the spec now hides before destroy, as every real opener does: `MpiModal.destroy` leaves its
  wrapper in the DOM).
- `tests/desktop/prompt-box-voice.spec.js`, `media-picker-to-history.spec.js` — TTS unchanged.
  13/13 across the four files. eslint clean; `npm test` 3791 pass / 0 fail on the first cut.

**Not checked.** Picking a library voice or a recording on LTX through to a generation; both ride
the same `onImport` / `onPick` paths an uploaded audio file already takes there.
