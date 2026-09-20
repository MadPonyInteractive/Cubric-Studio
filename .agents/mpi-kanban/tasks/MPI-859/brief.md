# MPI-859 - GIF cut-out masks must compose

## What Fabio reported (2026-09-20)

Adjusting a mask on a clip that already has a transparent background: By colour to pick up
leftovers from a previous run, then By name on the same frame. The second run threw the first
away. "The masks should be additive... maybe we need add and remove, like we have in the image
workspace, because otherwise this is very limiting. The image workspace already solved all the
masking that needs to be solved."

Second message, the shape he wants:

> The only difference here is that in the Gif workspace, we're going to need all frames, just a
> single frame, or selected frames. then we can have add and subtract. We already have clear in
> the mask icons.

## Why it happens

`MpiToolOptionsGifCutout` commits a run through `setTrackMask(idx, url)` / `setTrackMasks(urls)`
on `MpiGifViewer` - both REPLACE the frame's single `track` layer (`gifFrameMasks.js`). Brush
edits survive a re-track; method runs do not stack. That was the MPI-771 design: a track is a
starting point, the brush is the fix-up. It does not hold once three methods exist.

The image workspace's answer is already built and shipped: a Detect run (points / text / auto /
colour) renders GREEN as a candidate and waits for an explicit **Add** or **Subtract**, baked
app-side by `bakeAutoPicksInto()` - no AddMask/SubtractMask nodes, no second round trip
(`docs/masking-tools.md` section "Add / Subtract - the commit half").

## The shape (Fabio's call)

- Every method is a SOURCE, BiRefNet's Remove background included.
- The existing `All / Frame / Selected` scope radio says WHERE the commit lands. Selected is the
  frame strip's Ctrl-click set, already wired through `el.setSelection(viewerIndices)`.
- `MASK` becomes **Add** and **Subtract**.
- **Clear** stays as it is - the panel's Clear and the strip's right-click row already do it.

## Open questions for the build

- Does a run still auto-commit anywhere, or is Add/Subtract always explicit (the image
  workspace's Add is mandatory since MPI-382 - leaving the tool drops an uncommitted preview)?
- Where does the composite live: a second layer in `gifFrameMasks.js` beside `track`/`edits`, or
  does `track` simply become the accumulated mask with the candidate held separately?
- The Mask Brush composes into the same per-frame mask and MUST keep working
  (`docs/masking-sam3-gif.md`), including the display-flip rule.

## Already answered

- Mask by colour in the IMAGE workspace: shipped (`MpiToolOptionsMaskColour`, rail mode
  `maskColour` under Detect). Nothing to add.
- A cut resurrecting pixels an earlier cut removed: fixed in MPI-858.
