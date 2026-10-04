# MPI-1015 validation

## Phase 1 (2026-10-04, session 8c02ab18)

- `tests/desktop/video-history-strip.spec.js` (new, 4 tests). **RED on HEAD** for the first
  three: no `+` card / strip on a video card and H3 Reference absent from its picker; no
  "Video 1" clip chip on a reference model; the `+` pick cannot even open. The fourth
  (right-click Set as start frame lands a Start frame chip) passes on HEAD and after: a guard.
  After the change: **4/4 green**, incl. the swap (clip -> frame under the playhead as
  "Picture 1" -> clip) and the queued run config carrying `[video inputVideo, image inputImage]`
  on `ref2v_ms`.
- eslint clean on `MpiGroupHistoryBlock.js` and `MpiPromptBox.js`.
- `npm test` 2701 tests, 2699 pass, 0 fail. Desktop regression: every `prompt-box-*`,
  `history-*`, `media-picker-*`, `stack-history`, `gallery-stack*` spec: 23 passed.
