# MPI-1069 - Resize off the engine

## Why

Fabio, 2026-10-10, testing MPI-1062 in project "CP Tests": Resize on an imported phone clip
(`imported_002.mp4`, 2160x3840, 9:16, 14 s, 59.9 fps, 822 frames) failed with "Resize failed" and
the heads-up "Ran out of memory processing this". `app.log` 19:16:04Z:

    VHS load_video_nodes.py line 378: np.fromiter(gen, np.dtype((np.float32, (h, w, 3))))
    MemoryError: cannot allocate memory for array
    [WARN] [comfy] Out of memory - resizeVideo / null

And his second point: "when any generation is working, the resize tool stops being an option for
the user, and the user is pushed elsewhere."

## Root cause (one cause, both symptoms)

Resize is a ComfyUI graph (`commandRegistry.js` `resize` / `resizeVideo`, `injector: 'resize'`,
`comfy_workflows/resize.json` / `resize_video.json`).

- Memory: `resize_video.json` node 9 `VHS_LoadVideoPath` decodes EVERY frame at source size into one
  float32 tensor (custom_width/height 0, frame_load_cap 0) before `ImageResizeKJv2` touches it.
  822 x 2160 x 3840 x 3 x 4 B = ~82 GB; 64 GB box fails. The photographer tester (16 GB RAM) fails at
  ~160 frames of 4K: under 3 s of a 60 fps phone clip.
- Lockout: being an engine job, `MpiGroupHistoryBlock` disables Resize while Cue has any real job
  (`RESIZE_QUEUE_DISABLED_REASON`, MPI-253) and when there is no engine (`NO_ENGINE_TOOL_REASON`,
  MPI-856), and bounces the user to Crop (`_syncQueueBlockedTools`).

## Direction (to be planned)

Resize, flip, rotate and pad are plain pixel ops. Run them where Crop already runs: sharp for an
image, streaming ffmpeg for a video (`routes/videoCrop.js` is the pattern: scale/crop/pad/hflip/
vflip/transpose filters, constant memory, audio copied). Then the engine lock and the no-engine
dimming can drop for Resize. Keep: the live preview the tool runs on mount, the history entry
shape, stack mode, the pad colour, `divisible_by`.

**Decided (Fabio, 2026-10-10): no ComfyUI path at all.** "We can do everything this stupid resize
does with sharp, with our NPM packages. If we do that, we no longer have a tool that is blocked on
generations." So: sharp for images, the shipped `ffmpeg-static` for video, the engine lock and the
no-engine dimming removed for Resize, and the `resize` / `resizeVideo` graphs retired (check every
caller first: stacks, agents, routines, MCP, the operation registry). Do NOT delete a dep entry the
graphs pull in without reading `docs/playbooks/add-model/README.md` § "Removing or re-tiering".

Fabio wants a FRESH session for this card (not the MPI-1062 one).

## Noticed

- Four routes each carry their own `_resolveInput` (/project-file?path= -> disk path): videoCrop, videoGif, videoReverse, videoTrimInput. One shared helper would do; the tool head avoided a fifth by decoding client-side (`extractAbsPath`).
