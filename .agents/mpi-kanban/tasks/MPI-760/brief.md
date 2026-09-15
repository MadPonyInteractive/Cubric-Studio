# MPI-760 - Export GIF becomes GIF Maker

Umbrella: MPI-757 (phase 5, last). Read `tasks/MPI-757/plan.md` first. **Needs MPI-768** (frame
store and builder) **and MPI-769** (the workspace its new card opens in).

## Decision (Fabio, 2026-09-15)

GIF Maker creates a **new GIF card** in the gallery. It does NOT add a GIF entry to the video
card's history (that was the original ask; the dedicated GIF workspace replaced it, so a card is
either a GIF or a video and never switches icon by entry).

## What exists (verified 2026-09-14)

- **Tool def** `MpiHistoryTools.js` `VIDEO_TOOLS`, group `export`:
  `{ mode: 'exportGif', icon: 'to_gif_stroke', info: 'Export GIF' }`. Label also in
  `TOOL_LABELS.exportGif` (`MpiGroupHistoryBlock.js`), typedef in `js/components/types.js`, mount
  listed in `.claude/rules/component-mounts.md` (rule file: edit only with Fabio's permission).
- **Panel** `MpiToolOptionsGif`: fps / size preset / loop, "Generate preview" encodes a real GIF,
  "Export" emits `apply`. Settings persist to `toolSettings.exportGif`.
- **Encode** `_encodeGif` -> `POST /api/video/gif` (`routes/videoGif.js`): trim honoured
  (`_activeVideoTrim`), 2-pass palette, audio dropped, output in the OS temp dir. `_handleGifExport`
  saves it through `<a download>`.
- **New-card pattern** `_handleCropSnapshot`: upload into Media, `createItemGroup`, `addGroup`,
  `media:imported`, "saved to gallery" toast.

## Scope

- Labels: `Export GIF` -> `GIF Maker`, `Export` button -> `Apply`. **Keep the internal mode and
  settings key `exportGif`**, or every project's saved GIF settings are orphaned.
- Apply pulls **full-resolution** frames from the clip at the panel's fps, trim honoured, into
  MPI-768's frame store, builds the `.gif` at the size preset, and creates a new GIF card via the
  snapshot pattern. The preview stays (it is the built `.gif`).
- Decide whether the tool stays in the `export` group now that it no longer exports.
