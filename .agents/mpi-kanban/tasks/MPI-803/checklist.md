# MPI-803 — checklist

- [x] `js/utils/audioOutput.js`: `applySink`, `installAudioOutput` (document capture `play`), `setOutputDevice`
- [x] `AUDIO_OUTPUT_DEVICE` key + Storage getter/setter, mirroring MPI-573's input pair
- [x] Settings: Output plate + `MpiDropdown`, ONE `enumerateDevices` for both pickers
- [x] `MpiToast` chime gets the sink (detached element, invisible to the listener)
- [x] `installAudioOutput()` at `js/init.js` top level
- [x] ~~`speaker-selection` in `main.js`~~ — NOT needed, measured. `main.js` untouched.
- [x] Fabio's first pass: picking his speakers made playback audible
- [x] Option B: Output plate moved to the BOTTOM of the section (input first) + a Test button
      that plays the chime on the chosen device; `applySink` returns a boolean so a device that
      will not take is reported instead of playing into nowhere
- [x] `tests/audio-output.test.cjs` 5/5 (return value asserted), `npm test` green, eslint +
      `lint:components` clean
- [x] Fabio: Test button works; walking the list found Media/Chat audible and Sonar Game accepting-but-silent
- [ ] Fabio: Output is last in Settings → Audio, Test plays on the chosen device
