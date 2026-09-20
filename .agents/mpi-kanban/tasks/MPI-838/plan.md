# MPI-838 — plan

Three faults from Fabio's pass over the MPI-836 GIF output tool (2026-09-20). Every root
cause was traced before the card was written; `brief.md` holds them. This plan records the
decisions the brief left open and what was verified against source on pickup.

## Current State

All three fixes are IN and self-verified; the card is `validating`, waiting on Fabio's own
check in the app (verify mode is `user-ux`). Nothing is committed yet.

Evidence, the red/green runs and the two findings that are not mine: `validation.md`.

Next action: Fabio checks the three behaviours in the app (they are listed at the bottom of
`validation.md`). Then commit by explicit pathspec — this tree has live peers, and
`services/agentLoop.mjs` carries a peer's uncommitted edit that reddens a whole-tree lint.

Picked up 2026-09-20 from handoff `d657d150-ad0b-45c2-a4dd-5d8331bd3ee5`. All three root
causes re-verified against the live source before any edit — the named symbols all still
exist at the lines the brief gives. MPI-836 is already closed (CI green on `addb1c43`, run
35497523987), so nothing is outstanding behind this card.

## The three fixes

### 1. The preview spinner — and the scrim behind it

`MpiToolOptionsGifTiming.js:279,289` sets `spinner.el.hidden`. `spinner` is the mount
result, so `spinner.el` is the `.mpi-spinner` element, which carries
`display: inline-block` (`MpiSpinner.css:8`) — a class with `display` outranks the UA
sheet's `[hidden]`, so the attribute does nothing.

**Sweep, done on pickup.** Ten `MpiSpinner.mount` call sites; this is the ONLY one that
hides by attribute. The rest use a wrapper class toggle (`MpiCanvasViewer`, `MpiGifViewer`,
`MpiVideoViewer`, `MpiEnhanceDialog`), `style.display` (`MpiToolOptionsGif`,
`MpiToolOptionsResize`), `visibility` (`js/pages/components.js`), or mount/destroy
(`MpiStartingComfy`, `MpiLlmSettings`, `MpiEngineInstall`).

**Second fault found in the same read:** the wrapper is not just a spinner slot, it is a
`position: absolute; inset: 0` SCRIM with a `color-mix` background
(`MpiToolOptionsGifTiming.css:120-131`). Nothing ever hides it, so the preview pane has been
permanently dimmed as well as permanently spinning.

Fix is therefore both halves, and they are different bugs:

- Call site toggles the WRAPPER (`qs('#preview-spinner', el)`), which the panel's CSS already
  guards at `.css:134-140`. This is what kills the scrim; the primitive rule alone would not.
- One line in `MpiSpinner.css` — `.mpi-spinner[hidden] { display: none }` — so the primitive
  honours the standard attribute and the eleventh caller cannot repeat this. No caller sets
  `hidden` on it today, so the rule cannot regress one.

### 2. `range-preview` — the strip follows the handles live

`MpiTrimBar._flush()` emits the throttled `seek-preview` for the `playhead` role only;
in/out reach the outside world only through `_onPointerUp`'s `range-change`.

Add a NEW throttled `range-preview { in, out }` in `_flush()` for the in/out roles, reusing
the existing rAF coalescer, `PREVIEW_MIN_MS`, and the `_lastPreviewTs` / `_lastPreviewValue`
slots — only one role drags at a time and both reset on pointerup, so no second pair of
state is needed.

**`range-change` must keep firing on pointerup only.** `MpiTrimBar` is shared with
`MpiVideoControlBar`, whose Block persists trim on that event
(`MpiGroupHistoryBlock.js:3147`); firing it mid-drag would write on every frame of a drag.
A new event name is inert for video — the video bar subscribes to exactly three named trim
events (`MpiVideoControlBar.js:265,269,273`).

`MpiGifControlBar` re-emits it; `MpiGroupHistoryBlock` forwards it beside the existing
`range-change` wiring at `:604-606` → `frameStrip.el.setRange()` + `_options.el.onRangeChange()`.
That panel hook is `renderNote()` + `_markStale()` (`MpiToolOptionsGifTiming.js:324-328`) —
text and a class, safe at 20 Hz.

### 3. Home / End / I / O / X in the GIF workspace

`MpiGifControlBar.js:187-189` binds three registry ids. `MpiVideoControlBar.js:450-470`
already binds `video.frame.first`, `video.frame.last`, `video.trim.in`, `video.trim.out` and
`video.trim.clear`. Reusing the `video.*` ids in GIF mode is the established choice (this
file's own header comment says so, and a card mounts either bar, never both), so this binds
what exists rather than adding `gif.*` entries. Every `hk()` keeps its `_canDrive()` gate.

Decisions the brief asked for, from reading the video twin:

- **End goes to the OUT point, not the last frame.** `_frameBounds()` gives `lastFrame` as
  the clip's last frame only when the range is full, and `_out` otherwise — so Home→`in`,
  End→`out` is the video semantics, not a divergence from them.
- **I/O clamp exactly as video does:** `I` → `setRange(cur, out > cur ? out : frameCount-1)`,
  `O` → `setRange(in < cur ? in : 0, cur)`. Units are FRAME INDEX (`fps: 1`).
- **X belongs here.** Video has `video.trim.clear`; without it there is no key to undo an
  I/O, and it is one line in the same family.
- Home/End pause first, as the video twin does.

## Verification

**Verify mode:** user-ux

- `npx playwright test tests/desktop/gif-*.spec.js tests/desktop/video-*.spec.js --output=C:/pw838`
  — the output path MUST be short. A long one pushes frame files past Windows' 260-char
  limit; Node's `fs` copes and sharp does not, failing with `Input file is missing:
  ...<hash>.png`, which reads exactly like a product bug and cost a wrong "pre-existing
  failure" call on 2026-09-20.
- `npm run lint`
- Fabio's own check in the app: the preview pane is clear and un-dimmed when idle, the
  strip's dimmed range tracks a handle while it is being dragged, and Home/End/I/O/X drive
  the GIF bar.

## Remaining Work

- [ ] Fabio's check in the app, then commit by pathspec and close.

## Completed

1. **Spinner** — call site hides the WRAPPER (`MpiToolOptionsGifTiming.js`), plus
   `.mpi-spinner[hidden] { display: none }` on the primitive so caller eleven cannot repeat
   it. The wrapper toggle is the half that kills the scrim.
2. **`range-preview`** — throttled in/out event on `MpiTrimBar`, re-emitted by
   `MpiGifControlBar`, forwarded by `MpiGroupHistoryBlock` to the strip and the panel note.
   `range-change` still fires on pointerup only.
3. **Home / End / I / O / X** — bound in `MpiGifControlBar` on the existing `video.*` ids,
   in frame-index units, each through the `_canDrive()` gate.
4. One spec covering all three, proven red three ways (`validation.md`).
5. Docs: the event in `docs/video-player.md`, the keys in `docs/gif.md`.

## Plan Drift

- 2026-09-20: the spinner item grew a second half on pickup — the wrapper is a scrim, so the
  preview pane was permanently dimmed too. The brief only named the spin.
- 2026-09-20: `MpiFrameStrip` joined the footprint (claim and `files.json` both extended).
  `setRange()` called `_renderWindow()`, which rebuilds every `<img>` in the visible window;
  at 20 Hz that is DOM churn for three class flips, so `setRange` now repaints the range
  classes in place. This is the "watch the cost" the brief warned about — found by reading
  it, not by measuring a drag afterwards.
- 2026-09-20: the brief's "run `tests/desktop/video-*.spec.js`" names a glob that matches no
  file. The real shared-component consumers are `flow-audio-player.spec.js` and
  `history-modes.spec.js`, plus two node tests. Recorded in `validation.md` so the next
  session does not run an empty glob and read it as a pass.
