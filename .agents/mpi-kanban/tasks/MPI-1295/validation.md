# MPI-1295 validation

- **Agent probe (isolated Electron app, prompt box mounted alone, sdxl -> wan-22, then back
  to sdxl 1.5 s in):** the clip's transform was sampled every frame. Video's peek rose from
  translateY(100%) to 0 in about 0.4 s once playing, held to the clip's end (3.0 s), dropped
  back in about 0.4 s. The switch back to sdxl waited until that clip was fully out (3.37 s),
  then swapped to vision's peek and slid it up the same way. Wrapper opacity stayed 1.
- `tests/desktop/prompt-box-peek.spec.js` passes. It now polls for live, since the window
  goes live once the clip is playing, not when play() is called.
- **Fabio's eye-test (2026-10-26):** "it slides in and out properly."
- Follow-up 002aaede4: the parked clip is hidden once its slide-down ends, so its box no longer lands on the video transport bar (flow-audio-player.spec.js:526).
