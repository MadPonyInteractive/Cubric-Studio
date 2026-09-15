# MPI-758 - Remove Background on video

Umbrella: MPI-757 (phase 1). Read `tasks/MPI-757/plan.md` for ordering.

## Ask (Fabio, 2026-09-14)

Integrate background removal in the video workspace. The image workflow already exists; feed
it the video's frames as a batch.

## What exists (verified 2026-09-14)

- **Graph** `comfy_workflows/remove_background.json`: `MpiLoadImageFromPath` (Input_Image) ->
  `LoadBackgroundRemovalModel` (birefnet.safetensors) -> `RemoveBackground` -> mask. Two outputs
  switched by `MpiIfElse` `Input_Bg_Use_Color`: `JoinImageWithAlpha` (transparent) or
  `ImageCompositeMasked` over an `EmptyImage` filled with `Input_Bg_Color`. Saved by `SaveImage`
  `Output_Image`.
- **Op** `removeBackground`: `js/data/commandRegistry.js` (`MEDIA_TYPE.IMAGE`, universal),
  `js/data/modelConstants/universal_workflows.js`. Image path in the history block:
  `_handleApply` -> `_runImageTool('removeBackground', { Input_Bg_Use_Color, Input_Bg_Color })`.
- **Panel** `MpiToolOptionsRemoveBg` (Transparent / Color + picker, persists
  `toolSettings.removeBackground`). Reusable as is for video.
- **Video op pattern** `_runVideoTool(operation, injectionParams)` in `MpiGroupHistoryBlock.js`
  already passes the active trim and appends to the group (`scope: 'groupHistory'`), the same
  path `videoUpscale` and `interpolate` use. Tool list: `VIDEO_TOOLS` in `MpiHistoryTools.js`.
- **Video I/O nodes** (ComfyUi-MpiNodes `video.py`): `MpiLoadVideo` outputs
  images/audio/fps/frame_count/duration/width/height/has_audio; `MpiSaveVideo` takes
  images/fps/audio and encodes `rgb24` -> `libx264 yuv420p`.

## Shape

A new video op (working name `removeBackgroundVideo`, mirroring `imageUpscale` /
`videoUpscale`): `MpiLoadVideo` -> the same BiRefNet chain on the frame batch -> `MpiSaveVideo`
with the source fps and audio wired through. New op = `commandRegistry.js`,
`operationRegistry.js`, `operation_registry.json`, the universal workflow mapping, release
notes (`docs/versioning.md` table). **Fabio authors the `raw/` graph; the agent hands him the
node list and runs `node scripts/sync-raw-workflows.mjs`.** Tool entry in `VIDEO_TOOLS`, panel
`MpiToolOptionsRemoveBg` mounted for the video mode, apply routed to `_runVideoTool`.

## Concerns found

1. **MP4 has no alpha.** `MpiSaveVideo` writes h264 yuv420p, so the Transparent option cannot
   survive the save as it stands. Color mode works today with no change. See Decision.
2. **VRAM grows with clip length.** ComfyUI's `RemoveBackground` (`comfy/bg_removal_model.py`
   `encode_image`) moves the WHOLE frame batch to the GPU and resizes all of it to 1024 before
   looping the model one frame at a time, and keeps every mask on the GPU until the final
   `torch.cat` + upscale. Estimate from tensor shapes, not measured: ~12 MB per frame for the
   1024 copy plus ~24 MB per frame for a 1080p source copy, so a 10 s 24 fps 1080p clip needs
   several GB before the model runs. Root-cause fix is chunking (a MpiNodes node that runs the
   removal per chunk and parks masks on CPU), through `/mpi-nodes-sync`. Measure first on a real
   clip; do not cap clip length (the user's GPU is the limit, a warning is the obligation).
3. **Transparent output reaches three more consumers** if chosen: the gallery hover proxy is
   `<id>.proxy.mp4` h264 (docs/gallery.md § Video hover proxy), so hover would show a black
   backdrop; the poster WebP keeps alpha (MPI-627); the paused-step canvas is mediabunny, whose
   1.50.8 typings expose `alpha?: 'discard' | 'keep'`, unproven in our player.

## Decision needed

Transparent video output:
- **A (recommended):** WebM VP9 with alpha. Needs an alpha save path in MpiNodes, an
  alpha-aware hover proxy, and a player check. Start with a one-clip spike proving Chromium
  `<video>` + mediabunny paint the alpha before building the rest.
- **B:** Color fill only for now (MP4, no pipeline change). Transparent follows as its own card.
