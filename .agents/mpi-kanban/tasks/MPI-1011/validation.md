# MPI-1011 Validation

## Phase 1 - seam (2026-10-02, session b487ee6b)

- Cause, read in the node (`ComfyUI-Mickmumpitz-Nodes/nodes/panorama_tools/nodes.py`
  `HarmonizeBoundary.run`): plate and mask are bilinear-resized (no antialias) to the decode
  size; `m < 0.5` counts as known. An edge that falls between decode pixels leaves a known pixel
  whose plate value is part black, and the 8x area-average solve carries it into the boundary
  condition. Only odd plate/decode ratios trigger it (3.01x and 2.0x sample on whole pixels).
- Fix: 687's `inpaint_mask` = 553 alpha -> KJNodes `ResizeMask` (to `GetImageSize` of the 682
  decode, bilinear: the same resize 687 does itself) -> core `GrowMask` (2, tapered). 686's paste
  mask unchanged. Raw + runtime edited together; `workflow-to-api.mjs` on the raw equals the
  runtime file node for node.
- Proof, REAL node classes (ResizeMask, GrowMask, HarmonizeBoundary, ComposeColorMatch), a
  perfect fill on a bright sky, worst of edge offsets 0..5 (scratchpad `harm_real.py`):
  1564x880 +8.88 -> +0.00; 1365x1024 +12.72 -> +0.02; 2731x1536 -0.01 both. Original pixels
  changed: 0.00/255 in every case.
- Graph checks: smoke `--plan --flows outpaint` preflight + required-inputs sweep clean;
  `validate-injection-rules` clean; 688-690 match the engine's `object_info` (no missing or
  unknown inputs). `tests/inject-params-titles` pins the new chain (22/22).

## Phase 2 - passes (2026-10-02)

- Outpaint's crop step declares `maxGrow: OUTPAINT_MAX_GROW` (a third per side). Fabio's 9:16
  frame round a 1920x1080 photo plans 3 passes (1800, 3000, 3413 tall). Tests:
  `agent-outpaint-frame` + `outpaint-passes` 11/11.
- `npm test` 2666 / 0 fail; eslint clean.

## Open

- NOT run live: one local Outpaint on a bright sky (seam) and one multi-pass fill - Fabio's look
  (verify mode user-ux). Outpaint joins the scoped re-smoke at the cut (MPI-595 B1).
