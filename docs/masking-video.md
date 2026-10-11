# Video mask — the Text tool and Extract (MPI-1073)

The video workspace's **Mask** group (`VIDEO_TOOLS` in `Compounds/MpiHistoryTools`) holds one
tool, **Text** (mode `videoMaskText`, panel `Organisms/MpiToolOptionsVideoMask`). It is the image
Text tool ([masking-sam3.md](masking-sam3.md)) on a clip, and its strip ends in the same
**Extract** as the image one ([masking.md](masking.md) § Extract). Agreed with Fabio
2026-10-11: SAM3 by name is the only method — mask + Extract already covers "remove
background", and the user picks what stays.

## The run

1. `POST /video-extract/source` (`routes/videoExtract.js`) encodes the trim range, long edge
   capped at 1024 (never up), H.264, `-fps_mode passthrough` — ONE output frame per decoded
   frame, under `Media/.video-extract-tmp/` (swept after an hour). Why capped: the loader holds
   every frame as float32 (1080p x 121 ~ 3 GB, 10 s of 4K ~ 24 GB), and SAM3 works at ~1008 px.
2. `runGifCutoutTrack({ op: 'gifCutoutSam3' })` — the GIF cut-out's runner and graph,
   unchanged ([masking-sam3-gif.md](masking-sam3-gif.md)). The name is stamped `name:N` with the
   panel's count, capped at 4 (the graph's fixed `max_objects`).
3. The masks land on the viewer: `MpiVideoViewer.el.setVideoMasks({ urls, trimIn, trimOut, fps })`.

**A track WRITES the mask — no Add / Subtract.** The one departure from the image tool, agreed
with Fabio: tracking a whole clip is slow, so a commit step would only add a click. A re-run
replaces the mask; the strip's Clear drops it; loading a different clip drops it too.

## The tint — `MpiVideoViewer`

A `.mpi-video-viewer__mask` layer placed on the video's LETTERBOXED content box (zoom and pan
included, whole pixels outward), holding a tint clipped by CSS `mask-image` + `mask-mode:
luminance` — the GIF viewer's playback tint, so no per-pixel JS runs while the clip plays.
Display mirrors `MpiCanvas`: white at the strip's opacity, black when inverted, B/W puts it
opaque on a black (inverted: white) backdrop.

**Frame mapping:** mask `i` belongs to source frame `ceil(trimIn * fps) + i`; the frame on
screen is `round(t * fps)`. During play `t` is `requestVideoFrameCallback`'s `mediaTime`
(one draw per PRESENTED frame); paused, `seeked` fires after `MpiVideoSurface` paints the
exact frame. Outside the tracked range the layer hides.

The viewer implements the `MpiMaskStrip` surface (`brush: false`: opacity, invert, B/W,
clear, `extractMask`). `setMaskPaintEnabled` is a no-op — there is no video brush.

## Extract — `POST /video-extract/apply`

The viewer emits `mask-extract { background, masks, trimIn, trimOut }` and the Block's
`_handleVideoExtract` posts it and lands the entry (operation `extract`, the `videoReverse`
landing). The cut uses the range the masks were TRACKED over, not the trim bar's current one.

- Masks pair with frames by INDEX: `settb=1/1000,setpts=N` on both streams. Two time bases
  can round a mask onto its neighbour; the test alternates masks per frame to catch that.
- **Transparent** -> WebM VP9 `yuva420p` + Opus. The RGB outside the mask is zeroed first by a
  HARD mask (any coverage keeps its colour): every alpha-blind decoder — ffmpeg's native vp9
  (the poster), the H.264 hover proxy — would otherwise show the original background.
- **Colour** -> overlay on a `drawbox` fill of the same frames, MP4 H.264 + AAC.
- Source audio kept, trimmed by the same input seek.

The app's player shows the WebM's alpha both paused and playing (checked 2026-10-11).
Spec: `tests/video-extract.test.cjs`.

**The source's own alpha is the ceiling** (`darken` = min with the mask), as in the GIF
cut-out, so a second Extract of a transparent WebM keeps the first cut. That needs the
`libvpx-vp9` DECODER on a vp9 source: ffmpeg's native one drops alpha, and the cut area
came back black. Other ops reading a transparent WebM (upscale, interpolate, GIF Maker) still
use the native decoder and see the zeroed RGB — black — where it was cut.
