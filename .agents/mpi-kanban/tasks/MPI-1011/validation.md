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

## Fabio's first look - 2026-10-02 (session 27738b6a)

- His run: 1024x1024 source, 9:21 frame (1024x2389). One prompt reached the engine (26.55 s,
  `app.log`), card flowOutpaint_009 = 1024x1706 = pass 1's frame; the flow screen said
  "Generation failed." with no log line. CI on `f04c5eb56` was green (run 36991237890).
- Pass 2 cause: both twins hand `composeNextPass` the completion `item` (`createImageItem`:
  `filePath`, no `url`); it read `url` -> null -> `nextPassCallbacks` onError "The next pass
  could not start." Fix: read `filePath`. RED first (`tests/outpaint-next-pass.test.cjs`:
  "a finished item must compose the next pass", actual null), then green. Staging reads
  `item.url || item.filePath` (`commandExecutor.js:167`), so the frame twin's
  `{...m, url}` reaches the engine.
- Seam, measured on flowOutpaint_009 (scratchpad `seam_measure.py`, `seam_freq.py`): original
  rows 341-1364 byte-identical; top edge (sky) step +0.78 luma; bottom edge (cuts the horse)
  excess step mean 2.99 / p95 9.0 smoothed over 33 px, vs 0.42 / 1.15 inside the original.
  The 8x block solve pins the correction ~5-16 px inside the original, not at the edge row.
- Fabio: "remove cloud models from Outpaint"; then, shown a direct Klein edit (edit_019, no
  seam): OPTION 2, Klein's picture is the result ("if it's smaller, it's smaller"); passes stay
  at a third per side.

## Option 2 - built 2026-10-02 (not committed yet)

- Graph: 493 (feeds `Output_Image`) reads 682 (VAEDecode); 686-690 removed from raw and
  runtime; every link of every active raw node checked against the runtime (27 match).
  `smoke-workflows.mjs --plan --flows outpaint`: flow preflight resolves, required-inputs sweep
  clean (51 graphs). `inject-params-titles` pins Output_Image <- VAEDecode and no
  ComposeColorMatch / HarmonizeBoundary.
- FlowDef: no "pixels kept" claim, no cloud id, no `cloudEdit`, no `requiredDeps` (no
  Mickmumpitz node left). `flow-cloud-edit` pins Outpaint cloud-free (RED first).
- `npm test` 2670 / 0 fail; eslint clean.

## Fabio's second look - 2026-10-02: PASSED ("Fantastabomb.")

- Committed `bf9588d59`. His 9:21 on the monkey after a restart: two passes, two cards
  (flowOutpaint_010 = pass 1, flowOutpaint_011 = the final, 672x1568, 13.5 s apart), two
  "Generation finished." toasts, the flow screen showed the result with "Done - saved to your
  gallery.", no line anywhere.

## Open

- CI on `bf9588d59`, then the done move. Outpaint stays in the scoped re-smoke at the cut
  (MPI-595 B1).
