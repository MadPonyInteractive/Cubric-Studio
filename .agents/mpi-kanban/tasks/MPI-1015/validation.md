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

## Phases 2 + 3 (2026-10-04, session 7ad19928)

- Deleted: `MpiToolOptionsPrompt/` (+ preload entry, typedef), PromptBox `getMediaByRole` /
  `removeMediaByRole` / `swapMediaRoles` (the panel was their only caller), `generationService`
  extend typedef + post-step + `trackConcatJob` import, `/extend-video`, the concat service's
  `inputRanges` (only `/extend-video` sent it), viewer `captureLastFrameAccurate` + surface
  `lastFrameIndex`. Kept `surface.captureFrameCanvas`: MPI-715's plan builds on it.
- `tests/desktop/video-history-strip.spec.js` 4/4 after the deletions. Related desktop specs
  (`history-*`, `prompt-box-*`, `media-picker-*`): 18 passed.
- `npm test` 2702 tests, 2700 pass, 0 fail (mirror test rewritten to the current rule, 6/6).
- eslint clean on every touched file.
- Concat service smoke (scratch script, real ffmpeg): audio + silent clip, forced re-encode =
  Combine's path, 3.04 s with audio; two identical clips take the demuxer fast path, 4.00 s.
- Docs (workspaces, generation-lifecycle, PROJECT, video-player, project-integrity), the five
  rule files, UNRELEASED (Important changes + What's new). Left: Fabio's look.
