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
