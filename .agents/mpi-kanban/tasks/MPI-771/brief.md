# MPI-771 - GIF cut-out with SAM3 by name

Umbrella: MPI-757 (phase 3, the first tool card; Fabio rates it the most valuable). Read
`tasks/MPI-757/plan.md` first; its decision table is settled. **Needs MPI-769** (workspace) and
MPI-768 (frames).

## The flow (decided with Fabio)

Tool group **Cut-out**: Mask by name -> Mask Adjust -> Cut out.

1. **Mask by name.** Text + count with the image workspace's rules (`js/utils/maskTextPrompt.js`:
   bare name = one object, `name:N` for several, never stamp `:1`, it detects nothing). Detect runs
   SAM3 **video tracking** over every frame, so the same object is followed frame to frame instead of
   re-detected (less flicker). Found objects appear as chips to keep or drop. The mask shows as a
   tint on the viewer and the strip thumbnails, so flicker is visible by scrubbing before committing.
2. **Mask Adjust.** Grow, shrink, edge band, fill holes: set once, applied to every frame. Preview on
   the current frame with the existing code (`docs/masking-adjust.md`,
   `js/components/Organisms/MpiToolOptionsMaskAdjust/`). For the all-frames apply, read that code
   first: run the same module server-side if it is importable, else do it in the graph
   (`GrowMask`, `MpiMaskFillHoles`).
3. **Cut out.** An **Invert** toggle (keep the object or remove it), then Apply: the server writes
   the mask into the alpha of the full-resolution frames (MPI-768) -> a new GIF entry. Edge colour is
   NOT here; it applies when the `.gif` is built (MPI-772's GIF output).

The mask lives until applied or the workspace is left. Mirror how the image workspace keeps masks
(`docs/masking.md`). If any mask is mutated on a canvas layer, the UndoStack rule applies.

## The graph: the agent authors it (Fabio's explicit permission, 2026-09-15)

Normally Fabio edits workflows and the agent syncs. For this one he delegated authoring. Still author
in `comfy_workflows/raw/` and run `node scripts/sync-raw-workflows.mjs`, so `raw/` stays the source.
Model it on the existing SAM3 graph, `comfy_workflows/img_auto_mask.json` (text branch:
`CLIPTextEncode` from the SAM3 checkpoint's own CLIP -> `SAM3_Detect`; docs/masking-sam3.md).
Shape: frame batch -> `SAM3_VideoTrack` (images + text `conditioning`) -> `SAM3_TrackToMask`
(`object_indices`) -> mask outputs.

**Check first:**
- `SAM3_VideoTrack` / `SAM3_TrackToMask` were read in the G: bench's `comfy_extras/nodes_sam3.py`.
  Confirm both exist in the SHIPPED engine pin (`dev_configs/node_lock.json`), not just the bench.
- A loader for a batch of frame files. If ComfyUi-MpiNodes has none, add one through
  `/mpi-nodes-sync` (a node ships only committed -> pushed -> pinned).
- Remote: `PATH_MEDIA_CLASSES` (`js/services/comfyController.js:1412`) decides which loader nodes
  get their media staged to a Pod. Prove a frame batch on RunPod (RunPod cards run one at a time).
- New op: `commandRegistry.js`, `operationRegistry.js`, `operation_registry.json`,
  `js/data/modelConstants/universal_workflows.js`, release notes (docs/versioning.md table).

## Memory

No batching in v1. Fabio masks 15 s 24 fps videos with SAM3 in ComfyUI with no memory issue. If a
very large GIF fails, show a clear warning; never cap the input.

## Done when

On a real mascot GIF: mask the mascot by name, the ground shadow is not in the mask, Cut out gives a
transparent-background entry, and scrubbing shows no edge flicker worth fixing. Runs on the local
engine and on RunPod. Fabio eye-checks the result.
