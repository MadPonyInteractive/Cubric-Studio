# MPI-1069 - Resize off the engine (sharp + ffmpeg, no ComfyUI)

## Current State

Project mode: scalable-foundation. Brief: `brief.md` (Fabio's decision 2026-10-10: no ComfyUI path).

**2026-10-10, BUILT and verified, uncommitted.** Resize (image + video) runs on sharp / ffmpeg through a
third generation head (`toolExecutor.js`, `executor: 'tool'`) on a fourth Cue lane (`tool`). The
rail lock and the no-engine dimming are gone for Resize; the graphs and injector are deleted. Fabio's
4K clip: 10 s, ~1.5 GB ffmpeg peak, node 71 MiB (was ~82 GB). Next action: close-out
(`mpi-end-session`). Gotchas found: a 1-px crop of a yuv420p frame fails in ffmpeg (height rounds to
0) - pad modes run in `gbrp`; testsrc2's bars meet at x=160, so a single-pixel parity check there
lies (chroma interpolation differs per conversion path) - compare row means.

Pre-build facts (kept for the record):

- Resize is two ComfyUI graphs (`comfy_workflows/resize.json`, `resize_video.json`) driven by
  `injector: 'resize'` (`js/services/workflowInjectors/resizeInjector.js`). The video graph's
  `VHS_LoadVideoPath` decodes every frame as float32 first: 822 x 2160 x 3840 x 3 x 4 B = ~82 GB.
- Graph = `ImageResizeKJv2` (KJNodes, read at `G:\ComfyUi\ComfyUI\custom_nodes\comfyui-kjnodes\nodes\image_nodes.py`)
  -> `ImageFlip` (x = vflip, y = hflip) -> `ImageRotate` (`rot90 dims=[2,1]` = CLOCKWISE).
- Lock: `MpiGroupHistoryBlock._syncQueueBlockedTools` (MPI-253) disables Resize while Cue has a
  real job, and the MPI-856 no-engine block dims it. Both exist only because Resize is an engine job.
- Callers of the `resize` / `resizeVideo` ops: the rail Apply (`_handleResizeApply` ->
  `enqueueGeneration`), stacks (`_runStackTool`, rule per member), the in-app agent / MCP tools
  `crop` + `downscale` (`agentToolOps.js` `RUNS`), routines (via the agent), Reuse of an old card.
  All go through `generationService`; only the panel's live preview calls `runCommand` directly.
- The pattern already exists: `cloudExecutor.js` (MPI-851) is a second HEAD for the same
  pipeline - own lane, POST to a route that writes bytes to scratch and returns `viewUrls`, then
  the unchanged save path lands the card. Engine refusal lives only in `ensureServerRunning`.

## Design (decided; say so, do not ask)

1. **A third head, `js/services/toolExecutor.js` `runToolCommand`** - `runCloudCommand`'s twin.
   Every caller keeps dispatching `resize` / `resizeVideo` unchanged, so history entry shape,
   sidecar, stacks, agents, MCP and Reuse all keep working. Ops opt in with `executor: 'tool'`
   on their `commandRegistry` entry; the seam in `generationService` picks the head from it.
2. **A fourth lane, `tool`**, in `generationStore` + `generationService` (every place MPI-851
   taught about `cloud`, incl. `_laneOf`, `_lanes`, the dispatch/orphan/running lists, the
   display engine). A Resize never waits behind a 10-minute generation. No Cue chip (only
   `local` is chipped). `tests/lane-agreement.test.cjs` extended.
3. **Server `services/resizeOps.js`**: ONE pure planner `planResize(srcW, srcH, params)` with
   KJ v2 semantics (stretch / resize / total_pixels / crop + position / pad family + position,
   `divisible_by` floor, pad extended right/bottom to divisible, then flip, then rotate CW), and
   two renderers: sharp for images (`limitInputPixels: false`, `autoOrient`, alpha KEPT, PNG out)
   and an ffmpeg filter chain for video (crop -> scale flags -> pad colour / `fillborders=smear`
   for pad_edge_pixel / per-side edge-mean overlays for pad_edge / blurred-cover bg for
   pillarbox_blur -> hflip/vflip -> transpose=1/2 ; even dims for yuv420p; libx264 crf 18 medium,
   aac like `videoCrop.js`; trim as `-ss/-to`). Streaming, constant memory.
4. **Route `routes/toolResize.js`**: `POST /tool/resize` -> scratch file + `viewUrls`;
   `GET /tool/output/:name`; `POST /tool/resize-preview` (thumbnail data URL -> PNG bytes, same
   sharp renderer). A client abort kills ffmpeg (`res` close). Scratch swept after 1 h.
5. **UI**: the panel preview fetches `/tool/resize-preview` (no `runCommand`, no queue job).
   `MpiGroupHistoryBlock`: delete the queue lock and drop Resize from the no-engine dimming.
   Method list trimmed to nearest / bilinear / area / bicubic / lanczos: `exact` and
   `nvidia_rtx_vsr` never ran (KJ's list has `nearest-exact`; nvvfx is not installed) - old saved
   values coerce to the default.
6. **Retire the graphs**: delete both JSONs, `resizeInjector.js` + its index row, the
   `universal_workflows` rows and `injector: 'resize'`. KEEP the `operationRegistry` /
   `operation_registry.json` keys (old cards validate). No dep entry changes: the graphs pull only
   node packs (KJNodes, VHS, MpiNodes) that other graphs still use, and no weights.

## Implementation

- [x] Build the tool head end to end (resizeOps + route, toolExecutor + tool lane, panel preview,
  history-block gates, graph retirement, docs). **Verify:** new `tests/resize-ops.test.cjs`
  (planner numbers vs KJ maths; sharp output size + a pixel per mode; ffmpeg on a generated clip:
  size, audio kept, trim) and every touched test pass; `npm test`, `npm run lint`,
  `npm run release:check`; Fabio's real clip (`CP Tests/Media/imported_002.mp4`, copied to
  scratch, never written in place) resized through the route with peak memory measured; the
  isolated app (`npm run app:isolated`) runs an image and a video Resize from the rail with the
  live preview showing.

## Completed

- [x] 2026-10-10: everything in Design 1-6 built and verified (`validation.md`). New: `services/resizeOps.js`,
  `routes/toolResize.js`, `js/services/toolExecutor.js`, `tests/resize-ops.test.cjs`, `docs/resize.md`.
  Deleted: `comfy_workflows/resize.json`, `resize_video.json`, `workflowInjectors/resizeInjector.js`
  (unstaged deletions - `git rm` staged them in the SHARED index, reset back).

## Remaining Work

- Close-out (`mpi-end-session`): commit by explicit pathspec (`files.json` + the three deletions), push,
  release the claim. Ask Fabio about `.claude/rules/` first (Preservation Notes).

## Plan Drift

- 2026-10-10: `generationService` hand-listed the lanes in six places (each patched one at a time in
  MPI-851); folded into one `LANE_ORDER` + `_laneHolding` rather than adding `tool` to six lists.
- 2026-10-10: two desktop specs encoded the OLD behaviour and were updated, not worked around:
  `crop-resize-output` (stubbed the engine because Resize needed one; now Applies a still and a
  clip with none) and `agent-tool-ops` (expected the agent's crop PENDING behind an upscale; it now
  runs at once on the tool lane, which is the card's point).
- 2026-10-10: `isolated app` check replaced by the desktop E2E harness: a real-engine-root boot
  would have repaired Fabio's live engine to the pin a peer moved today (0.34 -> 0.39).

## Verification

**Verify mode:** auto

Automated: the tests above, lint, release:check. Proof: the 4K clip resizes with flat memory
(the server process and ffmpeg together stay far under 1 GB, against ~82 GB before) and lands a
history entry in my own isolated instance. The lock removal is code deletion, checked by reading
`_syncQueueBlockedTools` gone and Resize enabled with a pending Cue job in the isolated app.

## Preservation Notes

- Docs to update: the Resize doc home (find it; `docs/crop.md` is Crop only),
  `docs/generation-lifecycle.md` (fourth head + lane), `docs/comfy.md`, `docs/data.md`,
  `docs/runpod-remote-engine.md`, `docs/testing-harnesses.md`, `docs/workflow-authoring/media-inputs.md`.
- `.claude/rules/` names the resize injector/graphs (`comfy_injection.md`, `component-comfy.md`,
  `component-events-*.md`, `component-mounts.md`): ask Fabio before editing (Cardinal rule 5).
- `routes/remoteModels.js:838` cites `resizeVideo` as a historical measurement - leave it.
