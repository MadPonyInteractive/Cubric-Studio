# MPI-834 validation

## Root cause

`MpiTrimBar._applyWave(falsy)` set `--mpi-trim-bar-wave: none`, so the wave layer computed
`mask-image: none`. That is NO MASK, not an empty one: the layer painted its whole box
(`inset: -8px 0`, 58px, cap to cap) in solid `--ink-4`. Every clip without a `wavePath` got it:
every GIF (no audio, ever) and every silent video, which is every text-to-video output.
MPI-829 recorded "a silent clip is just a taller empty track"; it was a slab.

## Evidence

- **Reproduced before the fix**, real `01_base.css` + real `MpiTrimBar.css` in Chromium:
  `maskImage: "none"`, `bg: oklch(0.5 0.018 80)`, wave 58px over a 44px track, and a
  screenshot matching Fabio's report shape for shape.
- **After, REAL modules** (`MpiTrimBar` + `MpiGifControlBar` mounted from the tree over HTTP):
  - video bar, no wave: wave `getClientRects().length === 0`, track 44px
  - GIF bar: wave not rendered, track **28px**, bar row **61px** (the pre-MPI-829 row height
    `docs/video-player.md` records)
  - `setWavePath(<mask>)`: wave renders, 58px, cap to cap, as MPI-829 intended
  - `setWavePath(null)`: not rendered again
- `tests/desktop/gif-workspace.spec.js`: 9 passed (31.7s), including the new assertion
  `{ wave: 0, track: 28 }` on the real GIF workspace in Electron. Pre-fix those values
  measured 1 and 44.
- `node --test tests/video-waveform-derivative.test.cjs`: 7 pass (the inset-equals-handles
  tie still holds).
- `eslint` on the changed JS: exit 0.

## Not done, on purpose

- A silent VIDEO keeps the 44px track. Dropping it to 28px would make the bar row jump
  61 <-> 77px while stepping through a history that mixes silent and voiced clips.
- `docs/video-player.md` was already over the 200-line budget (262) before this card.
