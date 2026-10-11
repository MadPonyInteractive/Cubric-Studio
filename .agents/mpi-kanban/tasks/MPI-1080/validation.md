# MPI-1080 validation

Verify mode: user-ux (Fabio's eye-test closes it).

- 2026-10-11: design A approved by Fabio from `research/chips-mockup.html`.
- 2026-10-11: repro `prompt-box-chip-reorder.spec.js` RED on 5dc6c3e0e (LTX jittery drag
  positions 0,1,0,0,0,1...; Wan 2 chips rebuilt mid-drag), GREEN after the fix, plus the
  whole-picture shape checks (16:9 at ~142px, tall at 80px letterboxed, 3:1 capped 144px).
- Strip specs: start-frame-toggle + reorder 2/2; video-history-strip, media-picker-to-history,
  gallery-stack-run, prompt-box-voice, agent-chat 49/49. ESLint clean on the JS and specs.
- Visual self-check screenshots (LTX in video orange, Wan i2v one picture, hover X): OK.
- 2026-10-11: Fabio eye-test PASSED in his app ("Looking fabulastic"): LTX ref2v 9 pictures + start frame, Wan i2v two frames, history video screen one picture as Last frame.
