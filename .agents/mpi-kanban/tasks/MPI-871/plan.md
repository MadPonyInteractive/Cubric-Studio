# MPI-871 - plan

## Current State

Not started. Root cause identified and recorded in `brief.md`; nothing has been changed.

## The decision the implementer must take FIRST

Fabio has not been asked what playback should DO, and the answer changes the whole shape.
Ask him, do not pick silently:

- **(a) Playback clamps to the trim** - play `in -> out`, loop back to `in`. The trim bar
  becomes a preview range. Scrubbing/stepping outside it stays allowed.
- **(b) Playback stays whole-clip** and the trim is only an export range; the frames outside
  it are shown dimmed while playing so the meaning is visible.

(a) matches what he expected on screen. Do not build both.

## Remaining Work

1. Decide (a) or (b) with Fabio -> **verify:** his answer in writing on this card.
2. If (a): give the viewer the range. It is a NEW public input on `MpiGifViewer`, in the same
   shape as its existing setters, fed from wherever `MpiGroupHistoryBlock` already resolves
   the trim - do NOT let the viewer reach into the timing panel.
   **verify:** a desktop spec that sets a range, plays, and asserts the rendered frame index
   never leaves `[in, out]` and that the wrap lands on `in`, not 0.
3. Check the three other places an index moves, they will have the same hole: the wrap in
   `_scheduleNext`, `el.setFrameIndex`/step, and the `ended` emit + `_playsDone` loop count
   (a loop of N over a trimmed range must count N passes of the RANGE).
   **verify:** the spec covers wrap, step past the out-handle, and loop-count.
4. Reordering/deleting frames must keep the range valid - `gifFrameMasks.js:78` already has
   the rebind-on-reorder precedent to copy.
   **verify:** reorder with a trim set, assert the range still points at the same frames.

## Verification

**Verify mode:** user-ux - the fix is what playback looks like, and step 1 is his call.

## Plan Drift

(nothing yet)
