# MPI-999 Brief

Recordings: strip the silence from the user's audio recordings.

Umbrella: MPI-1000 (plan.md there holds the phase and file ownership).

## Why

Fabio, 2026-09-30: a take from the Record button keeps the dead air before and after the sound
(visible on the gallery waveform: a flat line after the speech). That silence goes into every
voice clone and every Flow the clip feeds.

## Shape

- Strip it when the take is made, BEFORE the review/Accept preview, so what the user hears is
  what gets saved.
- Default: leading and trailing silence only, with a short pad kept (a hard cut on a breath
  sounds clipped). Silence inside the take (pauses between words) stays: it is timing.
  Fabio's call if he also wants long inner gaps shortened.
- Threshold relative to the take's own peak, not a fixed dB, so a quiet mic is not trimmed away.
  A take that is ALL silence is saved as-is (or refused) rather than emptied.

## Where

- `js/components/Blocks/MpiAudioRecorder/MpiAudioRecorder.js` (the take, the review, Accept)
- `js/utils/toWavFile.js` decodes to 48 kHz mono PCM, the natural place to trim samples. BUT it
  is shared with the voice library (`MpiMediaPicker`), so trimming inside it would also cut a
  user's uploaded voice file. Trim in the recorder's path only (a pure helper next to
  `js/utils/wavEncoder.js`, import-free so it tests in bare Node).
- `js/services/dictation.js` is speech-to-text for the agent box, not a saved recording: out.

## Verify

- Unit (bare Node): a buffer with silence / tone / silence comes back with only the pads around
  the tone; all-silence and no-silence cases unchanged.
- Live on an isolated app: record with a pause at both ends; the saved clip starts and ends on
  sound, its duration is shorter by the silence.

## Noticed

- `toWavFile.js` keeps `WAV_RATE` private, so the recorder repeats `TAKE_RATE = 48000` with a keep-equal comment. Export it if the two ever need to move together.
