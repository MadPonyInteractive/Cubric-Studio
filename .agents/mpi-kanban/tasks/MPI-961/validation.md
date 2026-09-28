# MPI-961 validation

## Baseline (Phase 1) - 2026-09-28, master `256e8b11d`

### Instrument

`app:isolated` has no CDP port, so the rig is its GPU-ON twin, driven by Playwright
(`docs/testing-harnesses.md` section 6): `_electron.launch` with `CUBRIC_E2E` DELETED (GPU on:
`getGPUFeatureStatus` reads `gpu_compositing: enabled`, `2d_canvas: enabled`), own `CUBRIC_PORT`,
own `CUBRIC_E2E_USER_DATA`, scratch `APP_DOCUMENTS`, EMPTY scratch `CUBRIC_ENGINE_ROOT` (no engine,
so History has no model and opens in Transform/Crop; the Prompt tool is reached through the rail's
own `setMode`, the same `_activate()` a click runs). Window parked off-screen (`CUBRIC_BACKGROUND=1`),
1280x800, DPR 1. One launch per config, under `gpu_lease.py run`.

- Rig: `research/rig/` (copied from session 48110acd's scratchpad - copy the folder to a scratch dir and run it THERE, it writes `docs/`, `engine/`, `runs/` beside itself), run as
  `python <mpi-lib>/scripts/gpu_lease.py run --timeout 60 -- node perf.cjs full <4k|16k|32k> <tag>`;
  `ROWFIX=1` = the MPI-963 control (see below). Fixture: a COPY of project "Big Photos Test" with
  every sidecar path rewritten (`copy_fixture.py`), the target entry set as the card's selected one.
- Timings: in-page `performance.now()`; long tasks = `PerformanceObserver('longtask')`; frame
  intervals = one synthetic input per rAF for 3 s, 3 reps (MPI-787 method); a tool switch is timed
  from `setMode()` to the first rAF on which the target state holds (a blocked main thread delays
  that rAF), plus two frames. CPU profile per step via CDP `Profiler` (500 us sampling).
- Memory: `app.getAppMetrics()` private bytes per process type; GPU dedicated = Windows
  `\GPU Process Memory(*)\Dedicated Usage` summed over the app's pids, median of 3 (MPI-633).
- GPU condition: `nvidia-smi --query-gpu=utilization.gpu,memory.used` at start and at each memory
  snapshot, recorded beside every number. RTX 4060 Ti 16 GB, 64 GB RAM (NOT the tester's 16 GB).
- Display: 75 Hz, so 75 fps / 13.3 ms is the vsync ceiling, not a measured limit.
- `screenshotMs` is instrument cost (Playwright capture to prove pixels arrived), not an app number.

### GPU IDLE

nvidia-smi at run start / end: 4K `3 %, 1313 MiB` / `4 %, 1854 MiB`; 16K `23 %, 1323 MiB` (a
transient; 0-19 % at the snapshots) / `6 %, 4570 MiB`; 32K `0 %, 1371 MiB` / `19 %, 1737 MiB`.
Peer GPU work: none (lease free; MPI-941's Ollama scorer finished before the idle runs).

| step | 4K (4096^2 PNG 27 MB) | 16K (16384^2 PNG 345 MB) | 32K (32768^2 JPEG 57 MB) |
|---|---|---|---|
| (a) History open: canvas holds the image | 1.3 s | 8.7 s | `img.onerror` at 0.6 s |
| (a) ... pixels on screen | 2.2 s | **37.1 s** | never (canvas stays 300x150) |
| (a) ... longest main-thread block | 0.8 s | **27.8 s** (no frame for 27.8 s) | 0 |
| (a) ... entry rows all loaded | 4.3 s (1K+4K+16K ORIGINALS) | 5.3 s (same rows) | 0.5 s, row broken (w 0) |
| (b) `draw()` JS / to next frame | 0.3 / 13.4 ms | 0.4 / 13.4 ms | - |
| (b) transform-only frame | 13.4 ms | 13.4 ms | - |
| (c) wheel zoom (Space held), 3x3 s | 75 / 75 / 75 fps | 75 / 75 / 75 fps | 75 (empty canvas) |
| (c) pan (Space drag), 3x3 s | 75 / 75 / 75 fps | 75 / 75 / 75 fps | 75 (empty canvas) |
| (d) mask stroke, 3x3 s | 75 / 75 / 75 fps | 74.6 / **56.6 / 56.3** fps (one 400-414 ms frame each) | - |
| (e) Crop -> Mask (canvas to canvas) | 35 ms | **2.6 s** | never ready |
| (e) Mask -> Paint | 45 ms | 0.34 s | never ready |
| (e) Paint -> Prompt (`swapToPreview`) | **5.1 s** (4.6 s long tasks) | **11.7 s** | 0.3 s |
| (e) Prompt -> Mask (`swapToCanvas`) | **4.9 s** (4.8 s long tasks) | **10.5 s** (8.6 s long tasks) | never ready |
| (f) GPU dedicated: gallery / after open / Mask / Prompt / Mask again | 74 / 441 / 516 / 326 / 537 MB | 74 / **2220 / 3247** / 166 / **3248** MB | 74 / 64 / 53 / 56 / 52 MB |
| (f) GPU process private, open / Mask | 873 / 757 MB | **2701 / 3575** MB | 319 / 272 MB |
| (f) renderer (Tab) private, open / Mask | 268 / 263 MB | **1625** / 237 MB | 164 / 122 MB |

CPU profile, top self time (16K): open `(program)` 31.8 s + `_renderBase` 2.6 s (the first
`drawImage` of the full-res `<img>` into the 16384^2 base canvas); Crop -> Mask `clearRect` 2.5 s
(first paint of the fresh 16384^2 overlay); Paint -> Prompt `clearRect` 2.5 s + `toDataURL` 2.3 s
(`_persistLayers`); Prompt -> Mask `clearRect` 3.0 s + `drawImage` 0.4 s. Canvases at 16K in Mask:
base 16384^2, overlay 16384^2, mask 1024^2, screen 832x678.

(g) 32K: `[canvas] Failed to load image ... imported_002.jpg` then `[MpiCanvasViewer] Failed to load
image into canvas` and an `[unhandledrejection] [object Event]`; the entry row is a broken image.
Nothing freezes - the canvas is simply blank.

### Control: rows on thumbnails (the MPI-963 fix, simulated) - GPU IDLE

Clue: every Playwright screenshot cost ~2.3 s in the 4K and 16K runs but ~45 ms in the 32K run,
and ~2.2-2.3 s is the 16K's decode time. All three runs share one card whose History rows load the
ORIGINALS (MPI-963), so the 4K runs carry a 16K `<img>` row too. `ROWFIX=1` rewrites each
`.mpi-history-list__thumb` `src` to the entry's `thumbPathLg || thumbPath` (MutationObserver,
installed before navigate; rows then read 512 / 1280 / 1280 px). Everything else identical.
nvsmi start/end: 4K `22 %, 1112 MiB` / `4 %, 1731 MiB`; 16K `0 %, 1121 MiB` / `32 %, 6262 MiB`.

| step | 4K as-is -> rowfix | 16K as-is -> rowfix |
|---|---|---|
| open: pixels on screen | 2.2 s -> **0.7 s** | 37.1 s -> **5.0 s** |
| open: longest main-thread block | 0.8 s -> 0.2 s | 27.8 s -> **2.57 s** (`_renderBase` 2.5 s self) |
| Crop -> Mask | 35 -> 50 ms | 2.6 s -> **45 ms** |
| Mask -> Paint | 45 -> 42 ms | 0.34 -> 0.38 s |
| Paint -> Prompt | 5.1 s -> **0.34 s** | 11.7 s -> **3.9 s** (`toDataURL` 1.4 s, GC 0.5 s; long tasks only 147 ms, one 1.4 s frame gap) |
| Prompt -> Mask | 4.9 s -> **0.35 s** | 10.5 s -> **5.5 s** (one 2.76 s block: `clearRect` 2.7 s self) |
| mask stroke 3x3 s | 75 fps -> 75 fps | 74.6/56.6/56.3 -> 74.3/**54/56** fps (400-467 ms frames stay) |
| pan / wheel | 75 fps | 75 fps (one 160 ms frame in 1 of 3 pan reps) |
| screenshot (instrument) | 2.3 s -> 0.1 s | 2.4 s -> 0.1-0.35 s |
| GPU dedicated: open / Mask / Mask again | 441/516/537 -> 368/433/637 MB | 2220/3247/3248 -> 3556/3164/**4591** MB |
| GPU process private, Mask again | 847 -> 1168 MB | 3507 -> **4856** MB |

### What the baseline says (top costs, with numbers)

1. **The History rows loading the ORIGINAL (MPI-963) is the largest single cost, at 16K AND at
   4K.** A 16K `<img>` row is re-decoded (~2.3 s, matching `createImageBitmap`'s 2.19 s) whenever
   the compositor re-rasters it, and the main thread stalls on it inside unrelated work
   (`getBoundingClientRect` 2.3 s self at 4K, `clearRect` at 16K). It accounts for 32 of the 37 s
   16K open, ~4.6 s of each 4K Prompt<->tool swap, and ~7 s / ~5 s of the 16K swaps.
2. **What stays at 16K once rows are fixed is the canvas's own (Phase 3's target):** a 2.5-2.7 s
   main-thread block on the first paint of the 16384^2 canvases (open: `_renderBase`'s sync decode
   and upload; after `swapToCanvas`: `clearRect` on the fresh 16384^2 overlay), `toDataURL` 1.4 s
   in `swapToPreview`, 400-467 ms hitches in 2 of 3 mask strokes (cause not attributed yet), and
   **3.2-4.6 GB of dedicated GPU memory + a 3.5-4.9 GB GPU process**, which grows across a
   Prompt -> Mask round trip (3164 -> 4591 MB). At 4K the canvas costs are all < 0.4 s.
3. **At GPU IDLE, pan / zoom repaints are not a cost on this GPU, even at 16K:** 75 fps at vsync,
   `draw()` 0.4 ms JS, a full-`draw()` frame 13.4-13.5 ms vs a transform-only frame 13.3-13.4 ms.
   **Under GPU load they are THE cost - see § GPU BUSY** (16K `draw()` -> next frame 189-322 ms,
   2-6 fps).
4. **32K:** fails in 0.6 s (`img.onerror`), blank canvas, broken row - nothing freezes. Only the
   server rendition (S1) can open it.

### GPU BUSY

Fabio started a MiniMax H3 video generation in HIS app (ComfyUI `/queue` showed it running before
and after; `:3000` never touched). Four launches back to back, 11:45-11:54, same rig, tags
`busy-video` / `busy-video-rowfix`. nvidia-smi: `87-100 %` utilization and `9.5-15.6 GB` used at
every snapshot of every run (15.6 GB of 16 in 16K-rowfix Mask - VRAM nearly full). 32K skipped:
it fails in the decoder before the GPU matters.

| step | 4K as-is | 4K rowfix | 16K as-is | 16K rowfix |
|---|---|---|---|---|
| open: pixels on screen | 5.0 s | 0.8 s | 21.4 s | 7.4 s |
| open: longest main-thread block | 1.0 s | 0.26 s | 3.6 s | 2.65 s (`_renderBase` 2.6 s) |
| `draw()` to next frame (transform-only) | 13.3 (13.4) ms | 13.4 (13.3) ms | **322 (13.4) ms** | **189 (13.4) ms** |
| wheel zoom 3x3 s | 75/75/75 fps | 75/75/75 | **4.6/2.2/3.2** (frames to 827 ms) | **4.8/2.5/3.0** (to 1214 ms) |
| pan 3x3 s | 75/75/75 fps | 75/75/75 | **3.7/2.5/2.5** (to 774 ms) | **3.8/3.9/2.6** (to 921 ms) |
| mask stroke 3x3 s | 74.6/75/75 fps | 75/75/75 | **2.7/2.5/2.9** (to 2121 ms) | **5.7/2.5/4.3** (to 1534 ms) |
| Crop -> Mask | 65 ms | 50 ms | 4.4 s (`clearRect` 3.2 s) | 69 ms |
| Mask -> Paint | 39 ms | 39 ms | 1.1 s | 0.9 s |
| Paint -> Prompt | 7.1 s (one 4.3 s block) | 0.35 s | 15.2 s (`toDataURL` 4.6 s, `clearRect` 3.3 s, `_DisplayMip.destroy` 2.7 s) | 5.0 s (`toDataURL` 2.2 s) |
| Prompt -> Mask | 5.3 s | 0.38 s | 12.4 s | 6.6 s (`clearRect` 2.4 s) |
| GPU dedicated: open / Mask / Mask again | 467/517/532 MB | 375/437/545 MB | 2210/2217/1208 MB | 3485/3160/1119 MB |
| GPU process private, Mask again | 785 MB | 1173 MB | 3569 MB | 3490 MB |

(The 16K "Mask again" dedicated reading drops to ~1.1-1.2 GB while the GPU process stays ~3.5 GB:
with VRAM near full the driver is paging the canvases out of dedicated memory, which is itself a
cost.)

**What busy adds to the idle picture:**

- **At 16K, interaction collapses under load; at 4K it does not.** Same card, same video running:
  4K pans, zooms and strokes at 75 fps (vsync); 16K at 2.2-5.7 fps with single frames up to 2.1 s.
  The rowfix does not change that - under load the interaction cost is the canvas's own.
- **The cost is the full `draw()` of the 16384^2 canvases:** 189-322 ms from `draw()` to the next
  frame, while a frame that only moves the stack's CSS transform stays at 13.4 ms. So D3 (a
  gesture moves the transform, never repaints image content) has a measured target of ~15-25x
  under load, and D1's display cap is independently justified: at 4096 a full `draw()` costs a
  normal frame even under load.
- The rows (MPI-963) still dominate open and the Prompt swaps under load (4K: 5.0 s -> 0.8 s open,
  7.1 / 5.3 s -> 0.35 / 0.38 s swaps).

**Fabio's hand check (2026-09-28, his app 1.6.2, after the busy runs):** opening a 16K entry "took
about 30 seconds just to load the image and thumbnails in the history cards", and he saw little
difference GPU busy vs idle. Matches the rig's as-is open (37 s idle, 21 s busy): open time is the
rows + the first 16K canvas paint, both GPU-independent; the load-sensitive cost is interaction
(pan/zoom/stroke), which he did not time.

### D2 experiment (decode source for the display copy)

- Renderer, `createImageBitmap(blob)` in the same GPU-on instance (`perf.cjs decode`): 16K full
  **2.19 s, 0 long tasks** (off-thread); 16K with `resizeWidth: 4096, resizeQuality: 'high'` 2.66 s,
  0 long tasks; 4K 0.16 s. 32K: `InvalidStateError: The source image could not be decoded.` for
  BOTH the full and the resized call - Chromium cannot open the 32K at all. (Fetch of the 16K blob
  1.6 s.)
- Server, sharp 0.34.5 / vips 8.17.3, `limitInputPixels: false`, `.rotate().resize(4096, 4096,
  {fit: 'inside'}).webp({quality: 90})` (`sharp_display.cjs`): 4K 1.2 s, 16K **4.0 s**, 32K
  **2.0 s** (JPEG shrink-on-load), each output 1.2-1.3 MB.
- So S1 (server display rendition) is the only source that opens the 32K; the renderer can still
  decode the 16K off-thread for the detail layer (D4).
