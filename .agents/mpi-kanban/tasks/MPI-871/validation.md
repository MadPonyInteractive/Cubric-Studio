# MPI-871 - validation

## Reported

Fabio, 2026-09-21, live on `gif_113` (79 frames): playback showed frame 0022 while the trim
handles held roughly frames 0-9 (measured: selection 198 px of a 1592 px track = 12.4 %).
Operations were NOT wrong - only playback.

## Root cause (confirmed against the live files, not taken from the handoff)

`MpiGifViewer.js` had zero hits for `range` / `trim` across 999 lines, and its loop wrapped
on `_index >= _frames.length - 1` straight to `_index = 0`. The range itself was already
resolved and already fanned out: `MpiGroupHistoryBlock.js` pushed it to the options panel
and to `MpiFrameStrip` on both `range-change` and `range-preview`. The viewer was simply the
third consumer nobody added - which is also why option (b) needed no work: the strip's
dimming IS (b), and that is the state Fabio called a bug.

## Automated verification - PASSED

Extended `tests/desktop/gif-timing.spec.js` (the trim bar's own spec) rather than adding a
file. The assertions read the frame the viewer is SHOWING - the `<img>`'s resolved `src`
matched back to the frame list - never a flag or an internal counter (the MPI-859 lesson).

- `npx playwright test tests/desktop/gif-timing.spec.js --config=playwright.desktop.config.js`
  -> 1 passed (18.1s)
- every desktop GIF spec, because the viewer is shared: gif-timing, gif-workspace,
  gif-cutout, gif-make, gif-maker, gif-transform -> **20 passed (2.0m)**. Several of those
  drive playback directly (Space plays in Cut-out, play/step/scrub, PLAYING in the Mask
  Brush, Home/End/I/O/X on the bar), so the range did not break them.
- `node --test tests/gif-timing.test.cjs` -> 6 passed
- `npx eslint <the four changed files> --max-warnings=0` -> clean

### Proven RED on the pre-fix behaviour, one change at a time

A passing spec proves nothing on its own, and a spec covering three fixes proves one unless
each is backed out separately. All three were, and each failed on its OWN assertion:

| backed out | result |
|---|---|
| A - `_bounds()` returns the whole list (the exact pre-MPI-871 behaviour) | RED: "playback left the handles and showed frames 5,0,4" |
| B - `play()` no longer rejoins at the in-handle | RED: "playback left the handles and showed frames 5" (the start frame alone) |
| C - `_playsDone` counts passes of the LIST again | RED: "two passes of a 3-frame range end inside 4 s" - and the range assertions still PASSED, so the isolation is clean |

Restored afterwards and re-run green; the restored file was checked byte-identical (sha256)
to the pre-backout copy.

## Fabio's check - PASSED, card closed

2026-09-21: "Okay, great, it works now." Verified live in his own app, which is the only
place a user-ux card can be verified.

## CI - green on this card's own commit

`fix(MPI-871): GIF playback obeys the trim bar` = `3417bb87`, run 35587954794 -> **success**
(https://github.com/MadPonyInteractive/Cubric-Studio/actions/runs/35587954794). Pushed as
code alone, then judged, then closed - the split `.husky/pre-push` requires, since a card
does not close on an unjudged run of its own commit.

## Claim audit

`claim-auditor` re-checked all ten factual claims above against the working tree: **10
PROVEN, 0 findings** - including the two that are reasoning rather than code (that the
strip already dimmed out-of-range frames, and that clamping `setFrameIndex` would stop
`video.trim.in`/`out` widening the range).
