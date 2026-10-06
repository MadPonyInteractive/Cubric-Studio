# MPI-1034 checklist

- [x] One helper opens the picked mic with `exact`, falls back to the system default only when that device is gone (`js/utils/audioInput.js`)
- [x] Dictation, the recorder and the Settings mic test all use it
- [x] Probe: Focusrite picked -> track label is Focusrite, samples non-zero
- [x] Probe: stale/unplugged id -> default mic opens, no throw
- [ ] CI green on the commit
- [ ] Fabio: reload the app, pick Focusrite in Settings, dictate a line
