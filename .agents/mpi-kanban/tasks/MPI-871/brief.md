# MPI-871 - GIF playback ignores the trim bar

**Fabio, 2026-09-21, live in the app on `gif_113` (Cubric Studio Mascots, 79 frames):**
playback runs frames that sit OUTSIDE the trim handles.

## The evidence

Measured off his screenshot, not estimated:

- the trim track spans x251-1842 (1592 px); the selected range spans x251-448 (198 px)
- 198 / 1592 = **12.4 % of the clip**, so the handles hold roughly frames **0-9 of 79**
- the transport read **0022 / 0079** at that moment - the playhead was ~13 frames past the
  out-handle, and the filmstrip showed the frames past the divider dimmed while they played

This is a **display/playback** fault only. Operations are NOT affected: Apply, Make GIF and
the exports all resolve the range through `gifTiming.js` and cut correctly.

## Root cause (found, not guessed)

`js/components/Organisms/MpiGifViewer/MpiGifViewer.js` **has no concept of a trim range at
all** - grepping it for `range` / `setRange` / `playRange` / an in-out pair returns nothing.
Its playback loop walks the whole frame list and wraps on the full length:

```js
if (_index >= _frames.length - 1) {
    _playsDone++;
    if (_loop !== 0 && _playsDone >= _loop) { _stopPlayback(); emit('ended'); return; }
    _index = 0;              // <- back to frame 0, never to the in-handle
} else {
    _index++;                // <- walks past the out-handle
}
```

The trim lives on the other side of the boundary: `MpiToolOptionsGifTiming/gifTiming.js` owns
the math (its own comment calls itself "the ONE reading of the trim"), and
`MpiGroupHistoryBlock.js` resolves it per operation. That block already admits the gap in a
comment at line 744: *"operation already reads its trim through `_activeVideoTrim`; no GIF
one"*.

So the range is resolved for every consumer EXCEPT the viewer that plays the frames.

## Why it appeared now

MPI-836 made the control bar's trim bar the single trim ("the trim bar IS the trim, and rate
+ loop count are GIF output fields"). Before that the rail had its own Trim tool. The viewer
was never taught about the new one.
