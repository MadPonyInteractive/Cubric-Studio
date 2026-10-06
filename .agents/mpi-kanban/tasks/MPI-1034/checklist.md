# MPI-1034 checklist

- [x] One helper opens the picked mic with `exact`, falls back to the system default only when that device is gone (`js/utils/audioInput.js`)
- [x] Dictation, the recorder and the Settings mic test all use it
- [x] Probe: Focusrite picked -> track label is Focusrite, samples non-zero
- [x] Probe: stale/unplugged id -> default mic opens, no throw
- [x] CI green: Tests run 37469996453 on 546dc5fc1, which carries fd45d5948 (none ran on fd45d5948 itself)
- [x] Picking a mic is agent-verified: the real module in the app's own Electron opened the Focusrite (see validation.md)
