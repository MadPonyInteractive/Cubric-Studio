# MPI-1080 - Prompt box reference chips: tags above the picture, no swap icon, no flicker on reorder

Raised by Fabio, 2026-10-11, while eye-testing LTX 2.3 Reference to Video (MPI-1060) in his own app.
His screenshots (strip with three chips, tags reading "Picture" with the number hidden; the `@` picker
open over the strip) are in the MPI-1060 session's image cache, not in the repo.

## What he saw

1. **Tags cover the picture.** Each chip's tag bar (`Picture 1`, `Start frame`, `Video 1`, `Last frame`)
   sits ON the thumbnail and hides a big share of a 70 px chip.
2. **Tags run out of their chip.** A tag with the swap icon plus a long label ("Start frame") overflows.
3. **The swap icon is clutter.** He wants it gone.
4. **Reorder flickers.** Dragging a chip to a new place makes the chips jump all over the place.

## What he asked for

- Tags move **above** the chips, off the picture.
- The swap icon goes. The tag must still read as clickable where it IS a button (a comment in the code
  says the icon is the only "clickable" cue: there is no tooltip), so the redesign needs another cue.
  This is look-and-feel: show Fabio before landing it.
- Reorder moves smoothly.
- Every model's strip, not just LTX.

## Where it lives (all in `js/components/Organisms/MpiPromptBox/`)

- `MpiPromptBox.js` `_renderStrip(items)` (~line 1090): builds each chip; FLIP animation (remember rects,
  re-render, animate from the old slot) and a reorder fast path that re-stamps labels only.
- Three tag kinds, all with `renderIcon('swap', 'xs')`:
  - plain read-only tag: `<span class="mpi-prompt-box-media-strip__index">`
  - the LTX start-frame toggle (MPI-1060): `_startTag`, a mounted button, `__index--toggle`
  - the pinned video chip's frame swap (MPI-1015): `_swapTag`, emits `pinned-swap`
  - the i2v Start/Last frame role pill (`__role--toggle`, ~line 1219)
- Reorder: `_makeChipReorderable` (pointer events, not HTML5 drag: the root intercepts drag events for
  file drops) and `_moveMediaItem`. A midpoint-crossing rule already exists to stop a re-render per
  pointermove; the flicker Fabio sees remains. Every move re-renders the whole strip through
  `_emitMediaChange` -> `_renderStrip`, so start the investigation there (`.claude/rules/root-cause.md`:
  find WHY before patching).
- CSS: `MpiPromptBox.css` `.mpi-prompt-box-media-strip` (~line 578: absolute band, wraps, max two rows
  then scrolls, MPI-475), `__chip` (~636), `__index` (~686), `__index--toggle` (~708), `__remove` (~867).
  The remove X sits at `top: -12px` since MPI-1060 (it covered the tag number); with tags above the
  chips, rethink where it goes.

## Specs to keep green

`tests/desktop/prompt-box-start-frame-toggle.spec.js` (toggle, drag keeps the start frame, X above the
tag text: update that check if the X moves), `video-history-strip.spec.js` (frame swap tag),
`media-picker-to-history.spec.js`, `gallery-stack-run.spec.js`, `prompt-box-voice.spec.js`,
`agent-chat.spec.js`. Last run: 50/50.

## Not this card

- The start frame reverting to a picture on reorder: fixed in MPI-1060 (`_moveMediaItem` keeps
  `inputStartFrame`).
