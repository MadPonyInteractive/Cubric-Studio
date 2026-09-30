# MPI-999 Validation

## Built (2026-09-30, session 43678b37, phase 1 of MPI-1000)

**Changed the same day on Fabio's word: START only.** "The problem with recordings on the microphone is
the start only, not the rest." The end of a take is kept as recorded; `TRIM.padTailMs` is gone.

- `js/utils/trimSilence.js` (new, import-free): 10 ms RMS envelope; sound = within 30 dB of the
  take's loudest frame, 50 ms unbroken (a click or pop never counts); a 150 ms pad kept in front
  of the first sound, everything after it untouched; takes with a peak under -66 dBFS, all silence, or nothing to cut come back
  unchanged.
- `MpiAudioRecorder.js`: `trimRecording(blob)` decodes at 48 kHz, mixes to mono, trims, encodes
  with `encodeWav`. `onstop` trims BEFORE review; the review plays that WAV and Accept returns the
  same File. A `processing` state ("Trimming the silence...") covers the decode; Discard during it
  closes cleanly. Review says "Trimmed N s of silence off the start." when 0.1 s or more was cut.
- `toWavFile.js`, `wavEncoder.js`, `dictation.js` untouched (the voice library and dictation stay
  untrimmed; the unit test asserts it).
- Docs: `types.js` MpiAudioRecorderProps, `docs/component-contracts.md` § MpiAudioRecorder.

## Evidence

- `node --test tests/trim-silence.test.cjs`: 19 pass, 0 fail after the start-only change (exact cut
  point; the rest of the take kept to the last sample; no tail setting exists; quiet take; 1-sample
  click, 3 ms pop, click louder than speech; 1 s inner gap kept).
- `npx playwright test --config=playwright.desktop.config.js tests/desktop/recording-trim.spec.js`:
  1 passed. Drives `trimRecording` in the real Electron renderer (isolated profile and port):
  a stereo take (1.5 s silence, 2 s tone on the left only, 1.5 s silence) comes back 3.65 s
  (lead cut to the 150 ms pad, tail kept) within 20 ms, re-read as a WAV of the same length; an all-silent take is kept whole.
- `npm test`: 2463 pass, 0 fail, 2 skipped. `npm run lint:components`: clean.

## Left: Fabio's ear test (needs a real mic)

1. Record: stay silent 3 s, say a sentence, stop.
2. See "Trimmed ... s of silence off the start." Play: it starts at your first word.
3. Accept: the gallery waveform has no flat line at the start.
