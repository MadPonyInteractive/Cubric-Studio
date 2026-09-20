# MPI-836 validation

## Root cause

Every VIDEO operation resolved the control bar's trim through `_activeVideoTrim()`. No GIF
operation read the handles at all: `viewer.el.getFrames()` went straight to the route. The
only thing that touched them was a Trim panel whose entire content was a NOTE about them, so
setting a range and opening GIF output rebuilt the whole GIF (Fabio, 2026-09-20).

## What shipped

- `rangeBounds(count, range)` in `gifTiming.js` — the one reading of the handles: inclusive,
  clamped, either drag order, whole list when there is no range.
- `_opFrames()` in the Block — the frames on screen (staged strip edits included) sliced by it,
  plus the `lo`/`hi` that slice anything aligned to the full list.
- Through it: GIF output, its preview, Crop, Resize, Reverse, GIF to Video, and the Cut-out
  (whose per-frame mask batch is sliced by the same pair, so masks stay on their frames).
- NOT through it, deliberately: the strip pill's Update / Apply (that saves the staged list,
  and an Update writes in place — a range there would delete frames) and Save frame (a
  snapshot of the frame on screen).
- Rail: the Timing group is gone. Frame rate and loop count are GIF output fields, in the
  video GIF Maker's order. `timingEdit()` still owns all four edits, because the connector's
  GIF surface composes the same functions server-side.
- The rate field opens BLANK ("keep each frame's delay") and clears again after an Apply. A
  mixed-delay GIF has no rate to seed it with, and seeding one would silently retime the GIF
  on an Apply about colours. The note names the rate the ranged frames already play at.
- Loop is read off the entry, including when a history entry is picked (the panel is not
  remounted then — `onFramesChange(item)`).
- The preview's stale badge keys on rate, loop AND range as well as the build settings,
  because it runs the same `_gifOutputEntry()` Apply does.

## Evidence

- `tests/desktop/gif-timing.spec.js`, rewritten: rate 16 fps → Reverse → **a range set, then
  Apply** (the reported bug; 3 pages, not 6) with a loop count → a blank rate leaving the
  delays alone → 16 px transparent → Resize keeping the same range. Asserts the rail has no
  `timing` slot, and that the four list-only edits wrote no frame file while Resize wrote
  exactly the frames it kept.
- `tests/gif-timing.test.cjs`: `rangeBounds` and `uniformFps` pinned, including that trim and
  every operation read the same bounds.
- `tests/desktop/gif-workspace.spec.js`: a moved handle marks the preview stale and the next
  build encodes the trimmed range; a typed rate retimes what it builds.
- 17 GIF desktop specs and 58 GIF node tests green locally; lint clean.
- **Fabio tested the output tool in the app and reports it working.**
- CI: green on `addb1c43` (run 35497523987).

## The red it caused, and the lesson

`7d2000fd` reddened master: `tests/desktop/history-modes.spec.js` asserts the GIF rail's slot
COUNT (5) and names no tool, so sweeping for `gifTrim`/`gifSpeed`/`gifLoop` and for the panel
selector missed it. Fixed in `addb1c43`. **A rail change must grep for the count assertion,
not only for the tool names.**

## Wrong call worth recording

Two specs I called "pre-existing failures on this box" were my own long `--output` path:
frame files went past Windows' 260-char limit, Node's `fs` coped and sharp did not, failing
with `Input file is missing: ...<hash>.png`. With a short output dir both pass. Desktop specs
need a SHORT private output path.

## Open

Three faults Fabio found in the same pass are NOT this card: the forever preview spinner, the
strip not following a handle drag, and Home/End/I/O unbound in the GIF workspace. They are
MPI-838, with a brief and a handoff (`state/handoffs/d657d150-...json`).
