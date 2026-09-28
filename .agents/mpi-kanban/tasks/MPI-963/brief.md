# MPI-963 - Small previews load the ORIGINAL file (blank / slow on huge images)

UMBRELLA: MPI-962 (Big photos). Found 2026-09-28 by Fabio baselining MPI-961 on project
"Big Photos Test" (1K / 4K / 16K history card + a 32K import + a phone photo).

## Symptoms (Fabio, live app 1.6.2)

- Landing recent-project card for Big Photos Test is BLANK (newest card = the 32K import).
- History entry list: the 16K card's entries drew "bit by bit, top down, one at a time" BEFORE the
  canvas loaded - a full-size PNG decode per row. The 32K entry shows a broken-image icon.
- Gallery grid thumbnails are fine (they already use the sidecar thumbs, MPI-926).

## Cause (code read, confirmed by the symptoms; not yet reproduced in a test)

Two sites hand an `<img>` the ORIGINAL media file instead of the sidecar `thumbPath`:

1. `routes/projects.js` `findRecentProjectThumbnail` (~:163) returns `projectFileUrl(top.path)` - the
   newest card's original. Every sidecar already carries `thumbPath` (+ `thumbPathLg` when > 1280).
2. `js/components/Compounds/MpiHistoryList/MpiHistoryList.js` ~:138-141: `thumbPath` is used for
   VIDEO only; an image uses `item.filePath`.

A 32K original (4 GiB decoded) cannot decode in Chromium at all; a 16K PNG (345 MB) decodes for
seconds per row. Same class as the gallery fix MPI-926 - these two were missed.

## Fix sketch

- Both sites: prefer `thumbPath` (or `thumbPathLg` where the rendered size needs it), fall back to
  the original only when no thumb exists (old sidecars; the backfill pass at `routes/projects.js`
  ~:973 fills them). Landing: return the thumb's URL and `recentThumbnailType: 'image'` when the
  thumb stands in for a video.
- Sweep for other `<img>` sites fed `filePath` for an image (grep `filePath` next to `.src =`), e.g.
  the stack strip `_memberThumb` in `MpiGroupHistoryBlock.js` already prefers `thumbPath` - use it as
  the pattern.

## Verify

- Unit: a temp project whose newest sidecar points at a big original returns its `thumbPath` URL.
- Desktop: History entry-list rows render the `.thumb.webp` URL, not the original (assert the
  `src`), on a fixture with a thumb.
- Fabio: full quit + relaunch; Landing card shows a picture; opening the 16K card no longer paints
  the rows top-down, and the 32K row shows its thumbnail.
