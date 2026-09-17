# Pending `js/components/types.js` hunk (MPI-772)

`types.js` was under MPI-532's live claim (and MPI-774's claim 91f0ea6b) on 2026-09-17, so this
typedef was not applied. Land it by hunk once the file is released, then delete this file.

## New typedef, after `MpiToolOptionsGifCutoutProps`

```
/**
 * @typedef {Object} MpiToolOptionsGifTimingProps (Organism — js/components/Organisms/MpiToolOptionsGifTiming)
 * @property {Object} viewer - MpiGifViewer instance (reads getFrameCount())
 * @property {'gifTrim'|'gifSpeed'|'gifReverse'|'gifLoop'|'gifOutput'} mode - picks the tool
 *
 * MPI-772. One panel for the GIF timing and output tools. Each Apply saves a new
 * entry through POST /gif/entry (the Block's _saveGifEntry); no frame file is
 * written. Math in gifTiming.js. Settings persist to toolSettings.gifTiming.
 *
 * Block hooks on el: onRangeChange({ in, out }) — the control bar's trim range
 *
 * Emits:
 *   'apply' { tool: 'trim'|'speed'|'reverse'|'loop'|'output', values }
 */
```

## `MpiGifControlBar` typedef (if it lists methods/events)

- `getRange()` — `{ in, out }` trim handles in frame indices.
- `'range-change'` also fires when a new frame count resets the handles.

## Also pending: `js/shell/preloadStyles.js` (MPI-774 claim 91f0ea6b)

After the `MpiToolOptionsGifCutout.css` line:

```
  'js/components/Organisms/MpiToolOptionsGifTiming/MpiToolOptionsGifTiming.css',
```

Both sessions had claimed the file, so each waited on the other (MPI-774's message 550b11f3). At
11:03Z this session released it; reply a550e772 asks MPI-774 to add this line plus MPI-773's
`MpiToolOptionsGifTransform.css` (right after it) in its own commit. Check HEAD before re-adding.
The panels' own `css:` lists load the stylesheets on mount meanwhile.
