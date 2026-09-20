# MPI-837 validation

## What changed

MPI-834 stopped the wave layer painting a slab, but left a silent VIDEO on the 44px track
that exists only to hold a waveform, and paid for the GIF's 28px with a per-host override
(`--mpi-trim-bar-track-h`). The height now keys off the wave layer itself:

```css
.mpi-trim-bar__track { height: 28px; }
.mpi-trim-bar__track:has(.mpi-trim-bar__wave:not([hidden])) { height: 44px; }
```

The GIF bar's override is deleted — it has nothing left to say, and no host has to know
whether its clip carries audio. `:has()` is already load-bearing in this codebase
(`MpiBaseFlow.css`, `MpiGalleryGrid.css`, `MpiFlowResultDock.css`).

## Evidence — real modules in a browser, measured

| state | wave rects | track | bar row |
|---|---|---|---|
| silent video (no `wavePath`) | 0 | **28px** | 44px |
| `setWavePath(<mask>)` | 1 (58px) | **44px** | 60px |
| `setWavePath(null)` | 0 | **28px** | 44px |
| GIF control bar | 0 | **28px** | 61px |

With a wave, the handles measure 58px too — MPI-829's cap-to-cap property is intact.

- `node --test tests/video-waveform-derivative.test.cjs`: 7 pass (the wave inset still ties
  to the handles').
- MPI-834's `{ wave: 0, track: 28 }` assertion passes — now for the general reason rather
  than a GIF-only override. It lives in `tests/desktop/gif-workspace.spec.js`, in the test
  *"gif strip: right-click deletes a frame and offers the mask clear; the trim range paints
  on the strip"*. Cite it by TITLE: the assertion was at line 306 in 2fa7d3eb and is at 308
  now, because MPI-836 (7d2000fd) edited the file two hours later. The runner's own
  `gif-workspace.spec.js:253:1` in this card's evidence is the test's line AT THAT RUN, not
  the assertion's, and it has since moved to 255.

## The six red specs in that run are a live peer's, not this card's

`gif-cutout:446`, `gif-cutout:1018`, `gif-timing:73`, `gif-workspace:114`,
`gif-workspace:452`, `history-modes:91` fail on the rail: `railSlots` 4 where 5 is
expected, and `.mpi-history-tools__btn[data-info="Trim"]` null. A peer has
`MpiHistoryTools.js` uncommitted in the tree removing the whole Timing group under
**MPI-836** ("There is NO Timing group... the trim bar IS the trim now"), which is exactly
what those assertions count and click.

Proven, not inferred: `history-modes.spec.js:91` was re-run with both of this card's CSS
files restored to their HEAD content (saved and restored byte for byte through the
scratchpad, never `git checkout`/`stash`) and failed identically.
