# MPI-838 — three GIF workspace faults from Fabio's pass (2026-09-20)

All three found while checking MPI-836's GIF output tool. **The output tool itself is
fine — Fabio confirmed it works.** These are separate, and none is a regression from
MPI-836 except where noted.

Each root cause below was traced from the source before this card was written. Verify
the named symbol still exists, then fix; do not re-derive.

## 1. The preview spinner spins forever

`MpiToolOptionsGifTiming.js` mounts the spinner and hides it with
`spinner.el.hidden = true`, where `spinner` is the MOUNT RESULT — so `spinner.el` is
the `.mpi-spinner` element itself, which carries `display: inline-block`
(`MpiSpinner.css:8`). A class with `display` outranks the UA sheet's `[hidden]` rule,
so the attribute does nothing and the spinner runs for the life of the panel.

The panel's own CSS already guards the WRAPPER
(`.mpi-tool-options-gif-timing__preview-spinner[hidden] { display: none }`), and the
comment beside that rule names this exact trap (MPI-382) — the code just hides the
wrong element. Fix by toggling `hidden` on the wrapper (`qs('#preview-spinner', el)`),
both at mount and in `_setBusy`.

**Sweep it.** `MpiSpinner` is a shared primitive with no `[hidden]` rule of its own, so
every caller that hides `spinner.el` by attribute has the same bug. `MpiToolOptionsGif`
(the video GIF Maker) dodges it by writing `style.display` instead. Grep every
`MpiSpinner.mount` and classify; the honest fix may be one line in `MpiSpinner.css`
(`.mpi-spinner[hidden] { display: none }`) rather than N call-site fixes — decide per
`.claude/rules/root-cause.md` § 3, and if the primitive changes, check its other callers.

Pre-existing (MPI-771 shipped it), not an MPI-836 regression.

## 2. The frame strip does not follow a handle drag

`MpiTrimBar` emits `range-change` for in/out **only on pointerup** (`_onPointerUp`,
~line 260). During the drag it calls `_renderPositions()`, which repaints the bar
alone. The PLAYHEAD has a throttled live event (`seek-preview`, ~line 232,
`PREVIEW_MIN_MS`); in and out have no equivalent, so nothing downstream can follow.

Fabio wants the strip's dimmed range to track the handles live.

Shape: a throttled `range-preview { in, out }` during an in/out drag, mirroring
`seek-preview`'s rAF + min-interval pattern. In `MpiGroupHistoryBlock`, forward it to
`frameStrip.el.setRange()` and the panel's `onRangeChange`. **`MpiTrimBar` is shared
with the VIDEO control bar** — a NEW event name leaves video untouched; do not make
`range-change` fire during the drag, because the video Block persists trim on it
(debounced) and would write on every frame of a drag.

Watch the cost: the strip repaints dimming across every thumb. Throttle before
measuring twice.

## 3. Home / End / I / O do nothing in the GIF workspace

`MpiGifControlBar` binds exactly three registry ids — `video.playPause`,
`video.frame.back`, `video.frame.forward` (~line 187). The registry already defines
`video.frame.first` (home), `video.frame.last` (end), `video.trim.in` (i),
`video.trim.out` (o) and `video.trim.clear` (x), and `MpiVideoControlBar` binds all of
them (~line 447). Reusing the `video.*` ids in GIF mode is the ESTABLISHED choice here
(see that file's header comment), so this is binding what exists, not new registry
entries — and the `_canDrive()` guard every `hk()` already goes through stays.

Fabio's wording: **I snaps the in point to the current frame, O snaps the out point** —
the same semantics `MpiVideoControlBar` has. Note its Home seeks to `_in`, not 0. The
GIF bar's trim runs in FRAME INDEX (`fps: 1`), so the values are frame numbers, and
`el.getRange()` / `trim.el.setRange()` are the surface.

Decide and write down: does I/O clamp when the user sets in past out (video passes
`_out > cur ? _out : _duration`), and does X belong here too.

## Ownership

`js/components/Organisms/MpiGifControlBar/MpiGifControlBar.js`,
`js/components/Compounds/MpiTrimBar/MpiTrimBar.js`,
`js/components/Organisms/MpiToolOptionsGifTiming/MpiToolOptionsGifTiming.js`,
`js/components/Blocks/MpiGroupHistoryBlock/MpiGroupHistoryBlock.js`,
plus `MpiSpinner` and its callers if item 1's sweep lands there,
`tests/desktop/gif-workspace.spec.js`, `docs/gif.md` / `docs/video-player.md`.

`MpiTrimBar` and `MpiGroupHistoryBlock` are shared with the video workspace: run
`tests/desktop/video-*.spec.js` as well as the GIF specs.

## Testing note that will cost you an hour otherwise

Desktop specs need `--output` on a SHORT path (`C:/pw838`). The session scratchpad path
plus Playwright's own directory name pushes frame files past Windows' 260-char limit;
Node's `fs` handles long paths and **sharp does not**, so a build fails with
`Input file is missing: ...<hash>.png` and reads as a product bug. It cost a wrong
"pre-existing failure" call on 2026-09-20.
