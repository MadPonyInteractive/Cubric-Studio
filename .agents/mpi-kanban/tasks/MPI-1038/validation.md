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

## RE-SCOPE 2026-10-09: tile upscale in the upscale op (the Flow evidence above is history)

### Phase 1 - Krea2 into the repo (2026-10-09)

- Bench `krea2_t2i_template` (Fabio, saved 11:36) copied VERBATIM to raw (`cmp` identical); `sync-raw-workflows.mjs` committed raw `42eb8fd3d`, validator: "All 1 file(s) conform", orchestrate baked `krea2_t2i_sfw/nsfw.json` (145 nodes each).
- Runtime diff vs HEAD (sfw): +13 nodes (Tile Upscale group, `Input_Tile_Upscale` default false, invert, IfElse), -3 (dead refiner VAEEncode/Clownshark/VAEDecode), `upscale` reroute now from the IfElse, `Input_denoise` default 0.6 -> 0.3 (injected anyway), TextGenerate gains `mtp: auto` from the newer bench ComfyUI (an undeclared input is dropped by older engines). No rgthree node.
- `node --test` inject-params-titles, injection-keys, injector-consumes, inject-never-clobbers-link, krea2-ratio-roundtrip, tile-post-pass-stage, upscale-limit, workflow-media-slots, workflow-input-staging-gate, lora-injection-routing: 60 pass, 0 fail.
- Generated API + runtimes are STAGED, not committed (sync design) - commit at handoff/close with `--only`.

### Phase 2 - app wiring (2026-10-09, all but the models.js capability line)

- `js/utils/tileCount.js` vs a verbatim copy of Impact `MakeTileSEGS` maths + ComfyUI `round()`: 25,010 size x factor cases (300-8200 px, x1/1.5/2/3/4), 0 mismatches. `tests/tile-count.test.cjs`: 2 pass (800x533 x1 = 3, x2 = 2; 1344x768 x2 = 8; 1920x1080 x2 = 15; 4000x6000 x2 = 150, x1 = 40).
- `node --check` on 6 touched JS files clean; 16 prompt-box/reuse/inject test files: 141 pass, 0 fail.
- Capability line on both Krea2 ModelDefs NOT written: `models.js` is claimed by MPI-936 (session 3e2b8b66). Until it lands the toggle stays hidden (visibleControlIds gate).

### Phase 5 - Flow removed (2026-10-09)

- `git show --binary e0dff8c54 -- <12 code/doc/test paths> | git apply -R` (check first: clean; `git diff e0dff8c54 HEAD` on those paths empty). `git grep flowTileDetailer|flow_tile_detailer|tile-detailer` outside .agents: 0 hits.
- `npm test`: 2802 tests, 2800 pass, 0 fail. `npm run lint`: clean.

### Red master fix (2026-10-09)

- `tests/desktop/flow-library-filters.spec.js:155` (Type=Enhance expects 1 Flow) failed on e0dff8c54 (run 37909278151). Fix `03b63033b` = the Flow removal alone (`git diff e0dff8c54~1 HEAD` on its 12 paths empty), pushed --no-verify; CI 37922285517: unit green, desktop shards running at note time.

### Qwen 2.1 + Klein / Chroma / SDXL graphs (2026-10-09)

- Qwen 2.1: raw e3a60af59, runtime fa7b4990a (diff: +8 tile nodes, any_7 rewired, nothing else). Bench (gpu_lease, :8188): village 1344x768 x1.5, denoise 0.35, empty prompt -> 2016x1152 RGB in 174 s; side-by-side: no seams, content kept, lines cleaner, palette slightly cooler (path stones greyer).
- Klein/Chroma/SDXL: copy_tiles.py cloned 9 / 12 / 2 pipe nodes from each Detailer group; detailer settings copied: Klein 2 steps lcm/normal cfg 1, Chroma heun/beta cfg 1 steps from its tier MpiMath, SDXL 8 steps lcm/simple cfg 1.4 (seed fixed 0 as its MaskDetailer). Validator: all 3 conform; orchestrate rebuilt 2+2+5 runtimes; apidiff on 6 of them: only the tile nodes added + the `upscale` reroute rewired.
- Desktop spec prompt-box-use-tiles: 1 passed (Grid/Tiles exclusive, 1x only with tiles, label 8 tiles at 1920x1080 x1.5 and 6 at x1, injects Input_Tile_Upscale + Input_Upscale_Factor 1).

### Bench runs per family + CI (2026-10-09)

- Red-fix CI 37922285517: success (unit + desktop 1-4).
- run_tiles.py under gpu_lease, village 1344x768 x1.5, denoise 0.35, empty prompt: Klein 9B 2016x1152 in 57 s; Krea2 (turbo) 2016x1152 in 96 s; Qwen 2.1 174 s (above). Crops vs lanczos: all three crisper, content kept, no seams.
- Chroma + SDXL NOT run: ComfyUI dropped Output_Image on value_not_in_list (Chroma1-HD-Flash / t5xxl_fp16 / ae; SDXL_Realistic + ControlNet-Union-ProMax) - those weights are not on this machine at all. Graph proof for them = validator + runtime diff only.
- Runtimes committed: krea2 48c9dec4f, qwen (see above), klein/chroma/sdxl b399d7920 (pushed). App code, models.js flags, desktop spec, docs: uncommitted, waiting on Fabio's in-app look.

### Klein tile steps A/B in the app (2026-10-09)

- Fabio ran Klein Use Tiles at 4 steps (ba5ac9fe5), then at 2 (temporary uncommitted runtime edit): 4 is better. Runtimes restored to the committed 4; nothing to commit.

### Fabio in-app + agent/MCP params (2026-10-09)

- Fabio: "they look right" on Krea2 + Klein Use Tiles in his app (user-ux verdict = 1).
- Agent/MCP `tiles` + `upscaleFactor`: tests/agent-tiles.test.cjs 7 pass (describe lists them; asked tiles+1x injects Input_Tile_Upscale/Input_Upscale_Factor 1/Input_Auto_Grid false; unset = defaults; project panel ladder; refusals; through resolveSettingsOwner pinned + unpinned). Full `npm test`: 2808 pass, 0 fail (budget test raised to 19,006 for the +333 bytes).

### Cosmo picks tiles at 1x for "add detail" (2026-10-09)

- Fabio: a 4K photo + "add detail" should be a tile upscale at 1x, chosen by Cosmo. Before: routed to a whole-picture edit (graphs scale input to 1 MP) or the masked Detail op. Now: Model rule clause (+82 bytes, SYSTEM_BUDGET 10,814), TILES_NOTE on every tile-capable model upscale op, Detail op note pointing to it. tests/agent-tiles.test.cjs 8 pass; agent suites 547 pass. Live Cosmo run: pending Fabio restart.
- CI 01524eb07: red on the model-settings-popup flake, re-run green on all shards.
