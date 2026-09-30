# MPI-971 findings — where an image reaches the engine (2026-09-30, session dd0e0b12)

One read-only sweep; the chokepoints below were spot-checked against the tree the same day.
Line numbers drift: grep the symbol.

## The ComfyUI chokepoint

`ComfyUIController.runWorkflow` media loop, `js/services/comfyController.js` ~1575-1617. For each
param whose same-titled node is a path loader (`MpiLoadImage`, `MpiLoadImageFromPath`, ...):
- a `data:` value → `/comfy/stage-media-data-url` (`routes/comfy.js` ~410) →
  `<engine>/input/mpi_staged/mpi_staged_<hash>.png` (masks, paint layers);
- a `/project-file` value → HEAD check `_assertMediaSourceExists` → `_resolveMediaPath` →
  local `_stageLocalMedia` → `stageMediaFile` (`routes/comfy.js` ~344, hardlink or copy into
  `input/mpi_staged/<sha(path|size|mtime)>.<ext>`), or remote `_uploadRemoteMedia` →
  `/remote/upload/media` (`routes/remoteProxyForward.js` ~211) → `remoteUploadInput`
  (`routes/remoteModels.js` ~550, whole file into a Buffer, POST `/wrapper/upload/media`);
- the path is injected into `MpiLoadImage.string`, picker "None".

Callers of `runWorkflow` (all `js/services/commandExecutor.js`): `runCommand` (~2400, every model op,
universal tool and Flow), `runAutoMask` (~1104, already on the 4096 copy), `runGifCutoutTrack`
(~1246, video).

## The op-aware layer

- `_buildParams` (~668): media slots `params[slot.title] = item.url` (~793-838), legacy fallback
  (~847-850), `Input_Mask = payload.maskDataUrl` (~853).
- Precedent pre-pass: `_prepareTrimmedVideoInputs` (~141, called ~1631 before `_buildParams`).
- Flows: `submitFlowGeneration` → `enqueueGeneration` (`flowService.js` ~178-188, 287); derived
  media from `_deriveRunMedia` (`MpiBaseFlow.js` ~3428-3455) placed by `_placePreviewAsset` into
  `Media/.preview-assets/` (`routes/projects.js` ~522) — NO `.meta` sidecar.
- History tools: `_runImageTool` (`MpiGroupHistoryBlock.js` ~2690) — upscale, remove background.
- Cloud: `cloudExecutor._imagePaths` (~416) → `routes/deepinfra.js` `_readReference` (~255), capped
  4096², JPEG.

## Masks, references, frames

- References `Input_Image_2..8`, `Input_Start_Frame` / `Input_End_Frame`: ordinary media slots,
  same chokepoint.
- Mask: `MaskManager.getURL` → `_toSourceScale` (~986, ~1049-1058), full source size PNG data URL;
  working layer capped 4096. Full size because `InpaintCropImproved` asserts mask == image size.
- `Input_Paint` (Flows) redrawn to source size (`MpiStepPaint.js` ~72-80).
- Source-pixel coordinates: `headSwapInjector` boxes (Draw It In, Object Stamp).

## Workflows

- Inpaint / localised edit: `InpaintCropImproved` (target 1024², context factor 1, padding 32) →
  sample → `InpaintStitchImproved`, in klein_t2i, klein_9b_t2i, qwen_edit, krea2 sfw/nsfw, boogu edit
  balanced/high, t2i_ill_anime, flow_draw_it_in, flow_object_stamp. Result = source size.
- Unmasked edit: `ImageScaleToTotalPixels` 1 MP right after load (Klein, Qwen, Boogu, Krea2;
  reference slots too). i2v: LTX / WAN `ImageResizeKJv2`; H3 feeds frames/refs straight in.
- Detail: `MaskDetailerPipe` over the whole image (max_size 1024).
- Upscale: universal tool `image_upscale.json` = `ImageUpscaleWithModel` (4x baked) then
  `ImageScaleBy` (x1.5-x4, default 2); model `upscale` op = `UltimateSDUpscale` × factor
  (1.5/2/3/4, default 1.5); SeedVR2 ×1.5; PiD fixed 1024/2048. **No input or output size guard.**

## Reusable

- `resolveDisplayImage` (`routes/projects.js` ~210) + client `displayImage.js`: sharp
  `limitInputPixels:false`, `.rotate()`, fit edge (clamped 256..16383), WebP q90, cached
  `<Media>/.meta/<sidecar>.thumb.fit<edge>.webp`; returns the ORIGINAL when no sidecar owns the
  file; module reads `window` at load (dynamic import only).
- `imageSize` / `reduceImage` (`routes/imageImport.js` ~44/~53), `cropExtended` / `planExtendedCrop`
  (`services/imageCrop.js`), `compositeThroughMask` (`services/imageComposite.js` ~88, route
  `/project/composite-media`), `_readReference` cap pattern, `llm.js` ~525-564 extract-then-resize.
