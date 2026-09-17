# Pending `js/components/types.js` hunk (MPI-760)

`types.js` was under MPI-774's live claim 91f0ea6b on 2026-09-17, so this typedef was not
applied. Land it by hunk once the file is released, then delete this file.

## Replace the body of `MpiToolOptionsGifProps` (currently says "GIF EXPORT", Save-As, getExportParams)

```
/**
 * @typedef {Object} MpiToolOptionsGifProps (Organism — js/components/Organisms/MpiToolOptionsGif)
 * @property {Object} viewer - MpiVideoViewer instance (registry-uniform signature; unused directly)
 *
 * Video-only GIF MAKER (MPI-760; mode and settings key stay `exportGif`). Persists
 * project.toolSettings.exportGif: { fps, sizePreset, loop }. Parent injects the
 * preview encoder via el.setEncoder(fn) (fn(params) → Promise<{ url, byteSize,
 * fileName }> via POST /api/video/gif) and toggles el.setBusy(on) while a card is
 * built. "Generate preview" encodes a temp GIF → inline preview + file-size badge.
 * Emits: 'apply' { fps, sizePreset, loop } — parent posts /gif/maker and adds a NEW
 * GIF card; the video history is untouched.
 */
```
