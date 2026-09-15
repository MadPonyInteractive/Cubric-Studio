# MPI-759 - GIF as its own gallery asset kind

Umbrella: MPI-757 (phase 1, parallel with MPI-768). Read `tasks/MPI-757/plan.md` first; its
decision table is settled. **Waits on MPI-749**, which owns `js/utils/assetKinds.js`,
`MpiGalleryGrid.{js,css}`, `js/utils/icons.js`, `js/utils/galleryFilter.js` and `docs/gallery.md`.

## Scope

1. **Kind row.** One `ASSET_KINDS` row `gif` above `image`, `badge: true`, its own icon in
   `js/utils/icons.js`. Match an item carrying the `gif` field (MPI-768) OR an image item whose
   file is a `.gif` (legacy imports, before their frames are extracted). No new media type: a GIF
   stays `type: 'image'`, the same precedent as the 3D Scene's `splatPath`. The card chip and the
   filter panel both read this table, so both get the icon.
2. **Still until hover, hover plays** (Fabio: consistent with every card that plays audio/video).
   The card paints the WebP rendition like any image; hover mounts the built `.gif`; leaving the
   card or scrolling it out demotes back to the still. Ride the existing hover lifecycle: the
   scroll gate (`_isScrolling`), `_mediaHolds` ('overlay', 'generation'), the scroll-out demote.

## Why it plays only at some card sizes today (verified 2026-09-14)

`pickImageRendition` (`js/utils/galleryRenditions.js`) mounts `thumbPath`, the 512 WebP written by
`extractImageThumb` with `-frames:v 1` (one frame), for a box up to 512 device px. Above that it
mounts `thumbPathLg`, falling back to `filePath`. No `.1280.webp` is written above the source, so a
GIF narrower than 1280 has none: a large card mounts the original GIF and animates, a small card
stays still. A GIF wider than 1280 is still at every size. The fix is that a GIF card never mounts
the `.gif` from the ladder, only from hover.

Other surfaces already animate because they paint the original file: the PromptBox chip, the
landing page's recent thumbnail, the project cards (Fabio, 2026-09-14). Leave them.

## Memory

Chromium keeps decoded image data per URL and the page cannot evict it
(docs/gallery.md § Retention is per decoded URL). Hover bounds the cost to cards the user actually
hovers, at the built `.gif`'s size (1024 default). Measure a hover tour on the MPI-633 rig before
closing; record the command beside the number.

## Done when

- A GIF card shows the GIF chip bottom right and a GIF row in the filter panel.
- Every GIF card is still at every slider size, plays on hover, stops on leave.
- `tests/asset-kinds.test.cjs` covers the new row (both match paths); the hover spec proves no GIF
  `src` is mounted without a hover.
