# MPI-1114 validation

## Cause

`openMic()` asked for `audio: true`, so Chromium switched on its video-call processing: auto gain,
noise suppression, echo cancellation. A take ducked after its first syllables (the AGC) and sounded
phasey (the suppressor).

## Evidence

- Raw capture of the same Focusrite input with ffmpeg (dshow, no app, no Sonar), 2026-10-12: two spoken
  phrases held -19 to -25 dB RMS in every half second, with no decay. The hardware, driver and Windows
  were clean (no FxProperties on the capture endpoint, Scarlett 2i4 1st gen has no auto gain).
- `node --test tests/audio-input.test.cjs`: 6/6 pass, two new cases pin the raw shape on the picked
  mic and on the system-default fallback. ESLint clean on the three changed source files.
- Fabio's ear test after the fix, 2026-10-12: "No more phasing and no more ducking."
- Code commit `6fe830ba7`.

## Not done

Dictation keeps the processing on purpose. A 2-channel interface with the mic on one input is averaged
to mono by `trimRecording`, so a take can sit up to 6 dB under the raw input; not measured in the app,
the input gain slider covers it.
