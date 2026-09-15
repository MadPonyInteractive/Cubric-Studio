# MPI-757 large-plan investigation (2026-09-15)

Four read-only investigators (server store, gallery kind + Make GIF, history workspace, SAM3
engine) plus direct checks by the planning session. Everything below was re-checked against the
tree by the planning session; where an investigator was wrong, the correction is recorded so the
error is not re-learned.

## Engine: SAM3 video tracking is in the SHIPPED pin (no blocker)

- Pin `dev_configs/node_lock.json`: ComfyUI `v0.34.0` @ `12d52794`.
- `engine/ComfyUI_windows_portable/ComfyUI` is at exactly that tag (`git log -1`: `tag: v0.34.0`,
  `comfyui_version.py` 0.34.0). Its `comfy_extras/nodes_sam3.py` declares `SAM3_Detect` (:94),
  `SAM3_VideoTrack` (:266), `SAM3_TrackPreview` (:321), `SAM3_TrackToMask` (:479). The Pod image
  builds from the same pin.
- The G: bench is **0.34.2** (newer than the pin), so a bench read alone would NOT have proven it.
- `SAM3_VideoTrack`: `images`, `model`, optional `initial_mask`, optional `conditioning`,
  `detection_threshold` (0.5), `max_objects` (4; 0 = cap 64), `detect_interval` (1) -> `SAM3TrackData`.
  `SAM3_TrackToMask`: `track_data`, `object_indices` STRING (`"0,2"`, empty = all) -> MASK [frames,H,W].
  (Investigator-reported signatures; confirm against `/object_info` before authoring.)

## Feeding frames to a graph

- No directory/sequence loader is staged for remote. `PATH_MEDIA_CLASSES`
  (`js/services/comfyController.js:1412`) = `MpiLoadImageFromPath`, `MpiLoadAudio`, `MpiLoadVideo`,
  `VHS_LoadVideoPath`, `MpiString`: single FILE paths, resolved and uploaded to a Pod.
- `MpiLoadVideo` (ComfyUi-MpiNodes `video.py:193`): `string` path, `block_if_empty`, optional
  `force_rate`. `comfy_workflows/video_interpolate.json` uses `MpiLoadVideo` titled `Input_Video` ->
  `MpiSaveVideo` titled `Output_Video`.
- So the least-new-code input is: server encodes the frame list to a temp video, one video frame per
  GIF frame, fed through `MpiLoadVideo`. Remote staging then works unchanged. No `/mpi-nodes-sync`.
- CORRECTION: an investigator suggested `VHS_LoadVideoPath` loads a directory of PNGs. It loads a
  video file.

## Mask Adjust across frames, alpha write

- `js/components/Primitives/MpiCanvas/managers/distanceField.js` has NO imports and no DOM use
  (canvas appears only in comments): importable server-side, so the all-frames apply can run the
  exact math the preview runs.
- `services/imageComposite.js` exists: `compositeThroughMask` (:83, sharp mask-through-alpha),
  `fillMaskHoles` (:42, pure JS). CORRECTION: one investigator reported the file missing.
- `MpiMaskFillHoles` exists in ComfyUi-MpiNodes `img.py`. CORRECTION: `GrowMaskWithBlur` is NOT a
  core ComfyUI node (core has `GrowMask`); prefer the server-side module anyway (preview == apply).

## New op registration

- `docs/versioning.md:184`: a new op touches `commandRegistry.js`, `operationRegistry.js`,
  `operation_registry.json`, the universal workflow mapping, release notes. BUT `:200`: never edit
  `operationRegistry.js` / `operation_registry.json` by hand, `/mpi-version-bump` keeps them in
  sync. Hand-edit only `js/data/commandRegistry.js` (precedent `autoMaskImg` :956) and
  `js/data/modelConstants/universal_workflows.js` (:39).
- Detect runner precedent: `runAutoMask` `js/services/commandExecutor.js:918` (title-matched
  `Output_*` capture off `executed` events).

## Server: frames store hooks

- Delete paths: `DELETE /project-media/:projectId/:filename` (`routes/projects.js:1127`: file,
  sidecar, `removeItemThumbs` via `DERIVATIVE_RE` `<id>.(thumb|proxy|splat).*`, orphan latents) and
  `DELETE /delete-meta` (:2814). Both must run the frame sweep.
- Import: `POST /project-media/:projectId/upload` (:1418), sidecar written ~:1454-1503,
  `writeImageRenditions` (:1501). Extract-at-import hooks here.
- `add-from-cards` (:2046, "Add to project") writes a FRESH sidecar in the target project. A GIF
  copied this way loses its frames unless the route copies referenced frames and carries `gif`.
- Project duplicate is `fs.copy` of the folder (:363): frame refs are hashes relative to
  `Media/.gif-frames/`, so copies stay valid.
- Archive (MPI-678) is a flag flip, nothing moves on disk (docs/gallery.md:109): the sweep must
  count archived GIF sidecars as references, which it does if it reads every sidecar.
- `POST /project/cleanup-assets` (:1027) only touches `Media/.preview-assets/`.
- ffmpeg: `services/ffmpegBinary.js` (`ffmpeg-static` 6.1.1 / `ffprobe-static` in dev, packaged
  binaries in a build). Two-pass palette and loop remap: `routes/videoGif.js` (~:83-104).
  Output + sidecar + `nextSequence`: `routes/videoReverse.js` (:85, :134-161).
  Node test precedent with ffmpeg + temp dirs: `tests/audio-mix-levels.test.cjs`.
- Sidecar fields pass through to the client (`GET /load-meta` :2794 returns the sidecar;
  upload response mirrors `splatPath` ~:2302).

## GIF delays: PROVEN (scratchpad proof, ffmpeg-static 6.1.1, sharp 0.34.5)

Ground truth = a real GIF block walker (header, GCT, extension sub-blocks, image descriptors),
not a byte scan: a naive `21 F9 04` scan false-matches inside LZW data (read a "delay" of 58178).

| Build method | Wanted | Got (block walk) |
|---|---|---|
| concat demuxer `duration` per file + two-pass palette, `-fps_mode passthrough` | 10,50,3,2,7 | **12,48,4,1,7,4** (drift AND an extra frame) |
| same + `settb=1/100,setpts=round(PTS)` | 10,50,3,2,7 | 12,48,4,1,7,4 |
| constant-rate build (`-f concat` list, `-r 10`), one GIF frame per entry, then PATCH each Graphic Control Extension delay (2 bytes LE) | 10,50,3,2,7 | **10,50,3,2,7** exact |

- The patched GIF reads back identically through all three readers: block walk, sharp
  `sharp(p,{animated:true}).metadata()` -> `pages`, `delay` (ms, = hundredths x10), `loop`, and
  ffprobe `-show_frames` `pkt_duration` (in 6.1.1 the key is `pkt_duration`; `duration` is absent).
- Extraction `ffmpeg -i in.gif -fps_mode passthrough f_%03d.png`: one `rgba` PNG per GIF frame
  (5 of 5), alpha kept.
- Four real GIFs in `C:\Users\Fabio\Downloads` (2 to 30 frames, all constant delay): block walk,
  sharp and ffprobe agreed on frame count and every delay.
- Consequence for MPI-768: the builder writes delays by patching GCEs after the palette build;
  never trust demuxer durations. Delay 1 hundredth must never be written (Chromium plays it as 10).

## History workspace map (MpiGroupHistoryBlock.js, 2988 lines)

- `TOOL_OPTIONS_REGISTRY` :87 · `isVideo = _group.type === 'video'` :252 · viewer mounts ~:398-454 ·
  `MpiVideoControlBar.mount(gid('controls-mount'), { fps: 24, showTrim: true })` :447 ·
  `mountOptions` :503 · `_handleApply` switch :609 · `TOOL_LABELS` :668 ·
  `_handleCropSnapshot` :1760 · `_encodeGif` :1924 · `_handleGifExport` :1948 · destroy ~:2954.
- `MpiHistoryTools` is a COMPOUND: `js/components/Compounds/MpiHistoryTools/MpiHistoryTools.js`,
  `IMAGE_TOOLS` :54, `VIDEO_TOOLS` :152 (`exportGif` :180), `TOOL_LISTS` :185.
- `MpiVideoControlBar` (Organism) binds a `MpiVideoSurface` via `attachSurface`; time is seconds,
  frame index = `t * fps`. It takes no per-frame delays.
- `MpiToolOptionsCrop` drives the viewer through `viewer.el.setCropRatio()` / `setCropRect()`, not
  MpiCanvas directly (investigator report; confirm when MPI-773 starts).
- In-place rewrite helpers exist: `replaceHistoryItemById` (`js/data/projectModel.js:240`),
  `updateGroup` (`js/services/projectService.js:468`).
- NO desktop spec covers Group History image or video mode today. "Image and video unchanged" needs
  its own guard.
- Every tool card (771, 772, 773, 760) appends rows to the same small tables (:87, :609, :668,
  `TOOL_LISTS`): adjacent hunks, hence the settled serial order for the UI halves.

## Gallery

- `ASSET_KINDS` `js/utils/assetKinds.js:26-31` (scene, video, audio, image; first match wins;
  no imports so Node tests can load it). Checklist: docs/gallery-filters.md § Adding a media kind
  (row above `image`, a 24-unit FILL icon, tests). `to_gif_stroke` exists but is a stroke icon.
- Grid hover: `MpiGalleryGrid.js` (Compound, 2346 lines) `_promoteVideo` :1046, `_removeHoverVideo`
  :1091, `_mediaHolds` :226, `DEMOTE_MARGIN_PX` :58, rendition call `pickImageRendition(selected, …,
  { allowSource: !isVideo })` :938.
- Context menu is IN THE GRID (`Events.emit('ui:context-menu')` :1455, `combine` entry :1460 with
  `combineDisabled` :1425), emitting to `MpiGalleryBlock.js` handlers (`grid.on('combine')` :329).
  `combine` is the closer template for Make GIF than `_handleCropSnapshot`: server route builds the
  item, client `createItemGroup` + `appendToHistory` + `addGroup` + `grid.el.setGroups`.
- Hover specs: `tests/desktop/gallery-media-release.spec.js`, `tests/desktop/gallery-renditions.spec.js`.
