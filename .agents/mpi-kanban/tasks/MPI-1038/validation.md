# MPI-1038 validation

## Phase 1 - bench proof (2026-10-08, bench :8188, Impact Pack = shipped pin `429d0159`)

Graph = `comfy_workflows/flow_tile_detailer.json` (converter output of the raw, validator clean),
driven by `run_td.py` (session scratchpad) under `gpu_lease`; Klein 9B int8, 4 steps lcm, 0.35.
Outputs `D:\WORK\Images\Outputs\mpi1038\`. Drift = mean/max |diff| of 64 px block means (0-255).

| run | in -> out | time | drift | by eye |
|---|---|---|---|---|
| cartoon village x1, "2D flat shader, cartoon" | 1344x768 -> 1344x768 | ~60 s cold | 7.9 / 21.7 | content kept, a touch warmer, paper grain smoothed |
| cartoon village x2 | 1344x768 -> 2688x1536 | 145 s | 6.7 / 17.7 | content + palette kept, crisper lines (Fabio's recipe case) |
| photo bench.jpg x1, no prompt | 800x533 -> 800x533 | 15 s | 8.7 / **44.3** | **too much: bench shapes + paving pattern redrawn, watermark garbled** |
| photo bench.jpg x1.5 | 800x533 -> 1200x800 | 20 s | 4.7 / 14.0 | benches + paving kept, crisper |

Every run asserted output size = input x factor. Detail-only on a SMALL picture is the weak case:
denoise is relative to the working size, and Fabio's recipe disables the detailer's own upscale
(`guide_size 64`) because his tiles were always 1024.

**Fix, `guide_size 1024 / max_size 1536`** (a tile under 1024 is sampled at ~1 MP and scaled
back; a 1536 crop of a 1024 tile still runs natively, so VRAM is unchanged):

| run (g1024) | time | drift | by eye |
|---|---|---|---|
| photo x1 | ~15 s | 5.8 / 29.3 (was 8.7 / 44.3) | benches + paving pattern kept; diff map shows edges only, no tile blocks (`g1024_bench_diffmap.png`) |
| cartoon village x1 | 35 s | 7.7 / 18.0 (was 7.9 / 21.7) | same as before |
| cartoon village x2 (control) | 135 s | vs the guide-64 run: mean 1.7/255, <= 4 per 256 px block | same scene; some tiles there are under 1024 too |

Adopted: raw regenerated, runtime = converter output, `==` the benched g1024 API graph, validator
clean, inject test 24/24.

## Phase 4 - live run in MY isolated app (2026-10-08, :60019, engine :48188, under gpu_lease)

`live_td.py` (scratchpad): scratch project under the session scratchpad, its parent registered in
the user's `Documents/Cubric Studio/project-paths.json` for the run only and removed in `finally`
(checked after: 0 matches). Image staged via `place-preview-asset`, Flow run via
`/connector/generate` `flowId: tile-detailer`, the shipped guide-1024 graph.

| run | card | render | settings on the card | drift vs source |
|---|---|---|---|---|
| x2, "2D flat shader, cartoon" | `flowTileDetailer_001`, 2688x1536 | ~168 s incl. cold Klein load | `Input_Upscale_Factor 2, Input_Denoise 0.35` | 6.5 / 20.7 |
| x1 (detail only) | `flowTileDetailer_002`, 1344x768 | 36 s | `Input_Upscale_Factor 1, Input_Denoise 0.35` | 6.9 / 14.7 |

- Both sidecars carry `flowId: tile-detailer` + `flowInputs` (positive, the `.preview-assets`
  image as role image1, injectionParams) = what Reuse reads (add-flow 03); `madeFrom` = image1.
- By eye (`sheet_app_x2.png`): crisp line art, clean flat shading, content and palette kept.
- Trap hit, harmless: `/connector/generate` answers when the run ENDS, so a 120 s client timeout
  dropped the first call (and released the lease) while the job kept running; the lease was
  re-taken 30 s later by a hold-until-idle waiter. No product bug.
- Instance stopped by its parent tree (`stop_instance.ps1`); :3000 untouched (200 after).
- `npm test` after all edits: 2799 tests, 2797 pass, 0 fail.

## Phase 2/3 - wiring + agent (2026-10-08)

- `node --test tests/inject-params-titles.test.cjs`: 24/24 (new case pins titles AND that tiles
  + detailer read the scaled image).
- Agent read-back: does = "Add fine detail to a picture, and enlarge it first if you like",
  runs; the four agent tests 58/58.
- `npm test`: 2794/2795 before the preview; the red was `user-flows.test.cjs` "every shipped
  Flow ... validates" (no preview). Provisional `flow-tile-detailer.webp` (896x1120 crop of the
  x2 run) -> that file 14/14.
- eslint on every touched JS: clean.
- UI probe (own Electron, own port, `probe_td_ui.cjs`): run slide mounts MpiRadioGroup (None /
  1.5x / 2x, 2x selected), the slider at 0.35, MpiInput text, Cue. The 2-row text box clipped
  its placeholder -> rows 3.
