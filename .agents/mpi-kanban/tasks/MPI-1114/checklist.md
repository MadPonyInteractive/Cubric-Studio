# MPI-1114 checklist

- [x] `openMic({ raw: true })` asks with autoGainControl, noiseSuppression, echoCancellation all false
- [x] Recorder and Settings mic test open raw; dictation keeps Chromium's call processing
- [x] `tests/audio-input.test.cjs` pins both shapes
- [x] Fabio records a take in the app: level holds after the first syllables, no phasing
