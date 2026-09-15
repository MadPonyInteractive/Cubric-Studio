# MPI-773 - GIF transform and export tools

Umbrella: MPI-757 (phase 4, after MPI-772: both edit `MpiHistoryTools.js` and
`MpiGroupHistoryBlock.js`). Read `tasks/MPI-757/plan.md` first; its decision table is settled.
**Needs MPI-769** (workspace) and MPI-768 (frames and builder).

## Scope

| Tool | Behaviour | Result |
|---|---|---|
| Crop | Every frame, same rectangle. Read `js/components/Organisms/MpiToolOptionsCrop/` and `docs/crop.md` first: reuse the panel if it can drive a GIF frame rather than the image canvas. | New frames, new GIF entry |
| Resize | Every frame to one size. | New frames, new GIF entry |
| Save frame as image | The current frame at full resolution. | New image card |
| GIF to Video | Frames with their delays -> constant 30 fps h264 MP4 at frame size (even dimensions), frames repeated to hold each delay. A **background colour** field (default black) fills transparent areas, because MP4 has no alpha. | New video card |

The 9:16 case Fabio wants: Crop to 9:16 in the GIF workspace, then GIF to Video.

## Where things are (verified 2026-09-15)

- New-card pattern: `_handleCropSnapshot` in `MpiGroupHistoryBlock.js` (upload into Media,
  `createImageItem`, `createItemGroup`, `addGroup`, `media:imported`, "saved to gallery" toast).
- Video derivatives for the new video card (poster ladder + 720p hover proxy):
  `writeVideoDerivatives` `services/ffmpegThumb.js:256`.
- Server-side ffmpeg output with sidecar precedent: `routes/videoReverse.js`.

## Done when

- Three images -> Make GIF -> Crop 9:16 -> Speed 0.33 fps -> GIF to Video gives a 1080x1920 30 fps
  MP4 with a card, poster and hover proxy, each image held about 3 s.
- A pixel from a video frame matches the source image, not a 256-colour palette (the whole reason
  frames are full-colour).
- Save frame as image produces a full-resolution image card.
