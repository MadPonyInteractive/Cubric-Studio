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

## `js/shell/preloadStyles.js`: DONE

Landed in MPI-774's commit 88cfe347 (2026-09-17); nothing left here.
