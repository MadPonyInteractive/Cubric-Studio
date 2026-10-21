# MPI-1216 validation

## 2026-10-21 - edit size (session "Flux.3 integration 14")

`generate_flux3.py` `_keep_edit_size`: Custom size off + no mask -> EmptyFlux2LatentImage from
Input_Image's own width/height (MpiLoadImage outputs 2/3), each side rounded to /16, shrunk
(aspect kept) only past 2944x2944. Regenerated `flux3_t2i.json`: 5 nodes added, one input rewired.

- `tests/flux3-edit-size.test.cjs` 4/4 (wiring + the graph's own expressions on 768x1376,
  752x1360, 571x1021 -> 576x1024, 6000x4000 -> capped at the 4K area, aspect kept).
- `npm test` on the final graph: 3485 tests, 3483 pass, 0 fail, 2 skipped.
- Bench G:\ComfyUi 0.42.1, shipped runtime graph, app injections only, Turbo, gpu_lease:
  | input | output | wall |
  |---|---|---|
  | 768x1376 | 768x1376 PASS | 21 s |
  | 752x1360 | 752x1360 PASS | 21 s |
  | 3350x6000 | 2192x3936 PASS (8.63 MP, under 2944^2, aspect kept, coherent) | 237 s alone |

  First 3350x6000 try ran >5 min beside Fabio's app (16 GB full); bench killed to free his GPU, rerun alone.
- Live, Fabio's app via Cosmo (box + reference woman): detail_013 1088x1920 -> edit_039 1088x1920,
  "Success" (Fabio, 2026-10-21). Before the fix it would have come back near 1 MP.
- Cost to know: an edit of a big photo now renders at up to 8.6 MP, ~4 min on a 16 GB card
  (was ~21 s at 1 MP). Fabio's call ("If the model supports 4K, why a 1 MP reduction").
- Outside-the-edit change still ~12/255 mean (top 70%, mouse added at the bottom): the model
  redraws the frame; not the size bug. Fabio: boxes stay layout-only (brief.md section 2).

Harness trap: MpiLoadImage reads only inside ComfyUI's input/output/temp; a path elsewhere
blocks silently (status success, no output). Stage inputs in `G:/ComfyUi/ComfyUI/input/`.

## 2026-10-21 - zoom drift + Cosmo 8:5 2K (session "Flux.3 integration 15")

Measured first (`research/zoomchain.py` / `zoommeasure.py`, 3 chained "change nothing" edits of
detail_013 1088x1920, Turbo, gpu_lease, Fabio's app idle):
| graph | zoom after 3 | shift | change vs original 1st -> 3rd | per edit |
|---|---|---|---|---|
| A shipped (refs 1 MP) | x1.006 | -1.0% x, -0.5% y | 7.7 -> 15.0 | 36 s |
| B refs "keep resolution" | x1.002 (none) | 0 | 4.4 -> 9.1 | 46 s |
| D final fix | x1.002 (none) | 0 | 4.4 -> 9.0 | 46 s |

Cosmo's "8:5 2K" was a BOX edit (edit_040-043 carry a `mouse` box, no mask), not masked: app.log
01:24:03 `customSize=true ratio=8:5 qualityTier=2k`, Fabio stopped it at step 9, Cosmo re-ran
without a size (edit_043 1280x800) then tried an upscale. Reproduced on the bench
(`research/frame/t1_sheet.jpg`): edit_041 at Custom 1792x1120 on the shipped graph drops the
tiger and dog; with the fix they stay.

Fix `_ref_matches_frame` (generate_flux3.py): picture 1 resized (ImageResizeKJv2, centre crop,
/16) to the frame the latent is built from, node on `keep resolution`, pictures 2-10 scaled to
1 MP by ImageScaleBy (1x1 blanks stay 1x1). A Custom size of another ratio (>2%) keeps the old
1 MP picture 1 so the model reframes (`research/frame/t4_ratio_sheet.jpg`: a crop cut the scene).
- Big photo 3350x6000 -> 2192x3936 (`t3_sheet.jpg`): shipped re-composes (zoom x1.018, shift
  -3%, people moved, detail soft); fix aligned (x1.002, 0) with full detail. 519 s vs 204 s,
  VRAM 16.0 vs 15.1 GB (dynamic offload, no OOM).
- Final graph ran every op on the bench: t2i, i2i, edit off / Custom same ratio / Custom new
  ratio, masked edit (+Custom), inpaint, two-picture edit. All produced sane pictures.
- `tests/flux3-edit-size.test.cjs` 7/7 (3 new fail on the old graph); `npm test` 3494 tests,
  3492 pass, 0 fail, 2 skipped. Agent corpus/budget tests pass with the flux-3.md line.
- CI run 39536261773 on `8fb90437`: success. Card held in validating for Fabio's live look.
