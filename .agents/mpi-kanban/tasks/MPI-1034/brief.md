# MPI-1034 - the mic picker is ignored

Fabio, 2026-10-06: the mic stopped working in the app, every input tried, Focusrite included.

Measured in a throwaway Electron 41 (same binary as the app):
- `getUserMedia({ audio: { deviceId: { ideal: <Focusrite id> } } })` opens
  "Default - SteelSeries Sonar - Microphone", every time, with a fresh valid id.
- That Sonar virtual mic hands Chromium digital zero (every sample exactly 0).
- `exact` with the same id opens Focusrite and carries real signal.

So all three mic consumers (dictation, MpiAudioRecorder, the Settings mic test) record
the Windows default whatever the Settings picker says. Windows privacy allowed the app,
and Windows logged the app holding the mic, so nothing failed and nothing was logged.
