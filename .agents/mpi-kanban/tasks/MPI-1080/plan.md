# MPI-1080 - Prompt box reference chips: tags above the picture, whole picture, no flicker

Brief: `brief.md`. Design chosen by Fabio 2026-10-11: option **A** of
`research/chips-mockup.html` (impeccable shape pass).

## Design (agreed)

- Each chip is a column: **tag row above, picture frame below**. Nothing sits on the picture
  except the video type icon, the stack badge and the hover X.
- **Frame** 5rem (80px) tall; width follows the media's aspect ratio, clamped 5rem..9rem
  (`aspect-ratio: var(--ar)` + `min-width`/`max-width`). Picture shown WHOLE
  (`object-fit: contain`) on `--surface-viewer`; a tall portrait letterboxes inside 5rem.
  `--ar` set once from `naturalWidth/Height` (img `load`) or `videoWidth/Height`
  (`loadedmetadata`); audio stays square.
- **Tag** one line, ellipsis, never wider than its chip. Three looks, all off ONE token
  (`--accent-heat`, so it follows the workspace's family colour, Fabio: video/audio/image
  differ):
  - read-only (`Picture n` on H3, `Video 1`, two-image `Start/Last frame`): plain ink text.
  - clickable (LTX picture toggle, i2v one-image role pill, pinned clip frame swap): accent
    outline + accent text, hover tint.
  - clickable AND on (`aria-pressed=true`, LTX chosen start frame): accent fill.
  - No swap icon anywhere.
- **X**: inside the frame's top-right corner, shown on chip hover / focus-within.
- Every model's strip (shared `_renderStrip`).
- Keep class names `__index`, `__index--toggle`, `__role`, `__role--toggle`, `__remove`
  (specs + MPI-1015/1060 handlers key on them); add `__frame` (wraps thumb, type, stack, X).

## Flicker - root cause (prove first, then fix)

Hypothesis 1 (main): `_makeChipReorderable`'s midpoint test reads neighbours'
`getBoundingClientRect()` while `_playFlip` is still animating them (WAAPI transform), so it
tests where a chip APPEARS, not its slot. A just-moved neighbour still looks to be on the
other side of the pointer, the test fires again, the order flips back: oscillation.
Fix: hit-test against layout slots (rect minus the in-flight transform), one helper used by
both the dragged chip and neighbours.

Hypothesis 2: on the i2v two-picture strip `_roleKey` (`start:2`/`end:2`) changes on every
reorder, so `sameSet` fails and the strip is rebuilt (`innerHTML=''`): images reload and
the dragged node is replaced mid-drag. Fix: the fast path re-stamps tag TEXT and the
`--end` modifier; the key keeps only structure (which tag element kinds exist).

## Phases

1. **Repro spec** `tests/desktop/prompt-box-chip-reorder.spec.js`: LTX ref2v 3 pictures and
   Wan i2v 2 pictures; drag chip 0 across the strip in small pointermove steps WITHOUT
   waiting for FLIP to finish; record every order change and whether `<img>` nodes were
   replaced. Expect: order changes monotonically (no A-B-A), no node replaced. Must FAIL on
   current code (proves the cause).
   **Verify:** spec red before fix, with the oscillation / replacement visible in its output.
2. **Reorder fix** (hypotheses above, whichever the repro proves). **Verify:** repro green.
3. **Chip layout** per Design: `_renderStrip` (both paths) + `MpiPromptBox.css` media-strip
   rules + strip padding (X no longer at -12px; tags take the top). Update
   `prompt-box-start-frame-toggle.spec.js` geometry check (X inside frame, tag above frame,
   tag never overlaps picture, tag within chip width); add a whole-picture check (frame
   width tracks a landscape fixture's aspect). **Verify:** below.
4. Fabio eye-test in his app.

## Verification

**Verify mode:** user-ux

- `npx playwright test tests/desktop/prompt-box-chip-reorder.spec.js
  tests/desktop/prompt-box-start-frame-toggle.spec.js tests/desktop/video-history-strip.spec.js
  tests/desktop/media-picker-to-history.spec.js tests/desktop/gallery-stack-run.spec.js
  tests/desktop/prompt-box-voice.spec.js tests/desktop/agent-chat.spec.js` green.
- `npm run lint` clean on the two component files.
- Eye-test in `app:isolated` screenshots (LTX ref2v, Wan i2v 1 and 2 pictures, history
  video chip, audio chip), then Fabio's look.

## Blocker (resolved: MPI-1060 committed + released in 5dc6c3e0e)

`MpiPromptBox.js` / `.css` and `prompt-box-start-frame-toggle.spec.js` are claimed with
UNCOMMITTED edits by the live MPI-1060 session (`b5b40c00`). No edit until it commits and
releases them; message sent 2026-10-11.

## Current State

2026-10-11: Phases 1-3 done and green, uncommitted (MpiPromptBox.js/.css, both specs).
Root cause confirmed by the repro (red first): (1) the midpoint hit-test read neighbours'
FLIP-animated rects, so a 4px slip back after a swap swapped straight back (positions
0,1,0,0,0,1); fixed with `_slotRect` (rect minus in-flight translate). (2) Wan's two-frame
strip keyed the fast path on start/end, so every reorder rebuilt every chip; the key is now
structure only (`_tagKind` + stack), text/aria re-stamped by `_stampTag`.
One tag per chip now: on i2v with two pictures the old "1"/"2" index is gone, the
Start/Last frame tag says it. Fabio eye-test PASSED 2026-10-11. Next: close-out (commit, push, done).

## Plan Drift

(none)

## Completed

- Design shape pass + mockup (`research/chips-mockup.html`), Fabio picked A.
