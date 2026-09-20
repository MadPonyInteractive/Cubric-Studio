# MPI-838 — validation

## Proven RED on the pre-fix code, then green

One new spec covers all three faults: `tests/desktop/gif-workspace.spec.js` § `gif 838`.
It was run three times against pre-fix code, each time with a DIFFERENT fix backed out, so
each fault is proven on its own rather than all three behind the first assertion. Source
files were swapped to their `HEAD` blob and restored byte-exact from a scratchpad copy
(`git diff --stat` confirmed identical after each restore).

| Backed out | First failure |
|---|---|
| all six files at `HEAD` | `an idle preview pane shows no spinner and no scrim` |
| `MpiTrimBar.js` only | `the strip must dim while the handle is still down` |
| only the five new `hk()` bindings | `X resets the range to every frame` |

With every fix in: green in 2.9s.

## Suites

- **23/23 GIF desktop specs** — `gif-workspace`, `gif-timing`, `gif-transform`, `gif-cutout`,
  `gif-make`, `gif-maker`, `gallery-gif-hover`, `history-modes` (2.4m). `history-modes`
  matters here because it asserts the GIF rail's slot COUNT and reddened master on 7d2000fd.
- **6/6 `flow-audio-player.spec.js`** — the OTHER `MpiTrimBar` consumer.
- **15/15 node** — `flow-result-compare.test.cjs`, `video-waveform-derivative.test.cjs`.
- Lint clean on every file this card touched.

**Correction to the brief:** it says to run `tests/desktop/video-*.spec.js`. That glob
matches NOTHING — there is no such file. The real trim-bar/video-control-bar consumers are
`flow-audio-player.spec.js` and `history-modes.spec.js`, plus the two node tests above.
A `ls` of the glob returns an error; a `-g` run of it would have reported "0 tests" and read
as a pass.

## Not mine, and reported

`npm run lint` is RED on the whole tree at `services/agentLoop.mjs:1149` —
`'_isUnfinishedFile' is not defined`. That symbol appears 3x in the working tree and 0x at
`HEAD`, so it is a peer's uncommitted in-flight edit, outside this card's ownership and
untouched here. It cannot reach CI while it is uncommitted, but it does block any
whole-tree `npm run lint`.

## Closed

Verify mode is `user-ux`. Fabio's own check in the app is the last gate:

1. Open a GIF card → GIF output. The preview pane must be clear and UNDIMMED before a
   build, spin only while one runs, and clear again after.
2. Drag either trim handle. The strip's dimming must follow the handle while the button is
   still down.
3. Home / End jump to the in / out points, I snaps in to the frame on screen, O snaps out,
   X clears the range.

**VERIFIED BY FABIO IN THE APP (2026-09-20):** "the spinner only shows up when it
should now", "Hotkeys now work, and dragging the trim handle updates the green bars".
All three.

Committed `3f9105bb`, pushed, and **CI GREEN on its own commit** (run 35504637030).

His same pass found a FOURTH thing, which is not this card: longest edge 1024 and the
card still reading 1536x640. Root-caused to `pixelDimensions` describing the frame
store rather than the built file -> MPI-844, and the crop cap that exposed -> MPI-847.
