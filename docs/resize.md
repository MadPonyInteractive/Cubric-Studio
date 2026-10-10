# Resize (image and video)

The History rail's Resize tool: size, keep-proportion mode, pad colour, divisible-by, flip and
rotate, for a still (`resize`) or a clip (`resizeVideo`). **It runs on sharp and ffmpeg in the
app's own server, never on ComfyUI** (MPI-1069, Fabio 2026-10-10). Crop is a different tool:
[crop.md](crop.md).

Files: `services/resizeOps.js` (the maths and both renderers), `routes/toolResize.js` (HTTP),
`js/services/toolExecutor.js` (the generation-pipeline head), `MpiToolOptionsResize` (panel),
`MpiGroupHistoryBlock._handleResizeApply` (Apply). Tests: `tests/resize-ops.test.cjs`,
desktop `crop-resize-output.spec.js` (Applies both, with no engine).

## Why it left the engine

It was two graphs (`ImageResizeKJv2` -> `ImageFlip` -> `ImageRotate`). Two faults, one cause:

- **Memory.** The video graph's `VHS_LoadVideoPath` decoded EVERY frame at source size into one
  float32 tensor before resizing any: a 14 s 4K 60 fps phone clip is 822 x 2160 x 3840 x 3 x 4 B,
  ~82 GB, and died with MemoryError on a 64 GB box. A 16 GB machine died under 3 s of 4K.
- **Lockout.** As an engine job it queued behind every generation, so the rail disabled it while
  Cue had any job (MPI-253) and with no engine (MPI-856), and bounced the user to Crop.

Resize, flip, rotate and pad are plain pixel ops. Measured on that clip with the new path:
10 s, node 71 MiB, ffmpeg ~1.5 GB peak (decoder and encoder threads; flat for any length).

## One planner, two renderers

`planResize(srcW, srcH, params)` is the whole of the old node's maths (KJNodes
`ImageResizeKJv2.resize`), so a still and a clip cannot disagree about a size or an offset:

| `keep_proportion` | What happens |
|---|---|
| `stretch` | straight to W x H |
| `resize` | fit inside W x H, aspect kept, no padding |
| `total_pixels` | W x H as a pixel BUDGET, aspect kept |
| `crop` | cut the W:H aspect from the source at `crop_position`, then scale |
| `pad` / `pad_edge` / `pad_edge_pixel` / `pillarbox_blur` | fit inside, then pad to W x H at `crop_position`: a flat `pad_color`, each side's edge MEAN, the edge pixels repeated, or the picture blown up, blurred, 20 % greyed and dimmed to 35 % |

Then `divisible_by` FLOORS the size (one step minimum); for the pad family the padded frame is
rounded UP to it on the right and bottom. Then flip (`x` = top-bottom, `y` = left-right), then
rotate CLOCKWISE. The node used Python's `round()`, half-to-even; so does the planner (`pyRound`).

- **Still:** sharp. `limitInputPixels: false` and `autoOrient` on every input (16K photos, EXIF
  turned); alpha is kept (the old loader dropped it); PNG out. `extract -> resize -> extend` is one
  pipeline; `pad_edge` / `pillarbox_blur` compose on a `create` canvas; flip/rotate run on a
  materialised frame, because sharp orders a rotate by call order against resize and extend.
- **Clip:** one ffmpeg `-vf` graph, streamed, audio re-encoded AAC like Crop, a trim as `-ss/-to`.
  Pad modes run in planar RGB (`format=gbrp`): a 1-px edge row cannot be cropped from 4:2:0, and odd
  offsets would round to the chroma grid. `pad_edge_pixel` is `fillborders=smear`; `pad_edge`
  averages each edge to 1x1 and stretches it over the band. yuv420p needs even sides, so an odd
  frame loses its last row/column (`divisible_by` >= 2 never makes one).
- The test compares each pad mode's bands on a clip against the still renderer (row means).

Resampling is always Lanczos (Fabio, 2026-10-10): the panel has no Method dropdown, and an old
card's `upscale_method` is ignored. (`exact` and `nvidia_rtx_vsr` never ran on the graph anyway.)

## The path

1. **Apply** emits the panel's params; `_handleResizeApply` enqueues op `resize` / `resizeVideo`
   like before. Stacks (a rule per member), the agent's `crop` / `downscale` tools and Reuse
   dispatch the same op, so none of them changed.
2. **Head.** The op's `commandRegistry` entry says `executor: 'tool'`; `generationService`'s seam
   sends it to `runToolCommand`, the third head beside `runCommand` and `runCloudCommand`
   ([cloud-generation.md](cloud-generation.md)). Same `exec` handle, same callbacks: the save,
   sidecar and history entry are shared.
3. **Lane.** It registers engine `tool`, the fourth lane (`LANE_ORDER` in `generationService`,
   `LANES` in `generationStore`). A Resize runs beside a generation instead of behind it. No
   Cue chip (only `local` is chipped).
4. **POST `/tool/resize`** with a DISK path (the head decodes `/project-file?path=`). The result
   lands in `os.tmpdir()/cubric-tool`, served as `GET /tool/output/:id.<ext>`, swept after 1 h.
   A Stop aborts the request and the route kills its ffmpeg.
5. **Live preview** (single card only): `POST /tool/resize-preview` with the panel's 512 px
   thumbnail and thumbnail-scaled params, PNG back. No queue job, so nothing to lock. The
   thumbnail is `viewer.el.getSourceElement()` (the image, or a video's first frame); the
   canvas viewer is awaited with `whenSourceLoaded()` (the panel can open mid-load), and
   MP / SCALE / FREE size from `getSourceSize()`, the ORIGINAL, since past the display cap the
   element is a smaller copy (MPI-961).

The rail no longer dims or locks Resize: `_syncQueueBlockedTools` is gone, and Resize is out of
the no-engine set. The `operationRegistry` / `operation_registry.json` keys stay, so old cards
validate.
