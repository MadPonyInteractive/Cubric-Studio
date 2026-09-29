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

## Phase 2 (D3) - 2026-09-28, session 9bb6f112 (uncommitted on master `3f5771bd0`)

### What changed

- `MpiCanvas.drawView()`: a pan move and a wheel-zoom tick apply the stack's CSS transform, let
  `_DisplayMip.follow` redraw the display copy only when the zoom crosses a level, re-place the
  compare clip and redraw the screen canvas. Base and overlay are never touched. A bare wheel in a
  brush tool (brush size) redraws only the ring. Mouseup, Space and every setter keep the full
  `draw()`.
- Mask point dots and the grid moved from the image-sized overlay to the screen canvas (constant
  screen size, so they no longer tie the overlay to the zoom).
- `swapToPreview` holds the mask at its WORKING size (`MaskManager.getFlat` /
  `MpiCanvas.getMaskCanvas`, `_heldMask` in the viewer); the preview shows that copy and the
  source-size PNG (`InpaintCropImproved` needs mask == image dims) is encoded once, by the first
  `getCurrentMaskDataURL()` / `getMaskDataURLForEntry()` that asks - dispatch only.

### Checks (all run 2026-09-28)

- Unit: `node --test tests/crop-extend.test.cjs tests/eslint-tier-rule.test.cjs tests/layer-convert.test.cjs tests/mask-adjust.test.cjs tests/mask-tool-registry.test.cjs tests/paint-adjust.test.cjs`
  -> 103/103 pass (same 103 on HEAD before the change). `npx eslint` on the 4 touched files: clean.
- New spec `tests/desktop/canvas-pan-no-repaint.spec.js` (4096^2 image, Mask mode, counts every
  `clearRect/drawImage/fillRect/putImageData` per canvas role): 10 Space-drag pan moves and a
  wheel zoom across 1/2 scale make 0 calls on base and overlay; the view moved exactly 120 px;
  the display copy hands over to the native past 1/2; a brush-size wheel makes 0 calls; a point dot
  reads alpha 255 on the screen canvas and 0 on the overlay. PASS on the change; **FAILS on HEAD**
  (`pan ticks repaint only the screen canvas`, base/overlay counts > 0) - run by swapping the 4
  claimed files to their HEAD blobs and back (`scratchpad/head_check.py`, restore verified
  byte-equal).
- Desktop list: `npx playwright test --config=playwright.desktop.config.js` history-modes,
  mask-colour, mask-persist-roundtrip, canvas-downscale-quality, compare-native-resolution,
  crop-resize-output, stack-crop, gif-cutout, canvas-pan-no-repaint -> 16/16 pass
  (`test-results/desktop/.last-run.json` status passed, 12:33).

### Found while measuring, fixed in Phase 2 (D3: a mode switch repaints only what it changes)

- The swap `clearRect` blocks were NOT a fresh overlay's first paint (Phase 1's guess): call trees
  (`scratchpad/rig/attr.py` on the switch `.cpuprofile`s) put 2.5-3.3 s of `clearRect` in
  `_renderBase < draw < set activeMode` (and `< setMaskInverted`, `< resetView`: twice on
  Prompt -> Mask). Every setter and mode switch runs a full `draw()`, which repainted the unchanged
  16K base. Fix: `_renderBase` repaints only when its source or the canvas changed (the compare
  layer's `_compareDrawn` pattern; video always repaints; `_sizeImageCanvases`/`loadVideo` reset
  it; a `contextrestored` listener on the base resets base + compare and redraws).
- That exposed a decode cost: with the 16K `<img>` no longer drawn every frame, Chromium drops
  its decode, and `_DisplayMip` reducing FROM THE SOURCE at a new level re-decoded it - wheel reps
  crossing the 1/16 <-> 1/8 level fell to 1.7-2.1 fps with 2.4-2.5 s frames (run `after2`). Fix:
  the display copy reduces from the NATIVE canvas (already holds the pixels), and `sync(src, s,
  fresh=false)` redraws only on a level change while always copying box + clip. Experiment
  (`scratchpad/rig/mipq.cjs`, GPU on): a 16384^2 1px grating canvas reduced canvas -> canvas to
  1/16, 1/8, 1/4 reads std 0 with `low` and `high` (source std 127.5), 13-31 ms low / 71-135 ms
  high. `canvas-downscale-quality` (software path) still green.

### Rig re-measure, GPU IDLE, 16K rowfix (same rig, `ROWFIX=1`)

nvidia-smi at start / end: `24 %, 1633 MiB` / `16 %, 4920 MiB` (Fabio's app + ComfyUI open, no
job; lease free). Run `after3-idle-rowfix` (final code); `after2` = before the mip fix.

| step | Phase 1 rowfix | after (after3) |
|---|---|---|
| open: pixels on screen | 5.0 s | 6.1 s (after2 5.5 s) |
| open: longest main-thread block | 2.57 s | 2.80 s (after2 0.15 s - where the one 16K decode lands varies) |
| Crop -> Mask | 45 ms | 32 ms |
| Mask -> Paint | 0.38 s | **35 ms** |
| Paint -> Prompt | 3.9 s (`toDataURL` 1.4 s) | **2.1 s** (`toDataURL` 57-66 ms, 0 long tasks) |
| Prompt -> Mask | 5.5 s (one 2.76 s block) | 4.7 s (one 2.46 s block: the new canvas's first 16K paint, Phase 3) |
| pan 3x3 s | 75 fps | 75 / 75 / 75 |
| wheel 3x3 s | 75 fps | 75 / **33.7 / 38.5** (reps 2-3 cross a mip level every 4 ticks; max 240 / 80 ms) |
| mask stroke 3x3 s | 74.3 / 54 / 56 (400-467 ms frames) | 75 / 75 / 75 |
| stroke A/B, overlay backing 4096^2 (`after-idle`) | - | 75 / 75 / 75 (same as 16384^2 at idle) |
| GPU dedicated: open / Mask / Mask again | 3556 / 3164 / **4591** MB | 2201 / 3218 / 3234 MB |

The wheel reps that cross a level are below HEAD's idle 75 fps: each crossing is one GPU reduce of
the 16K canvas. Busy numbers decide whether that needs a per-level cache.

### Zoom IN (Fabio, live app after restart: "zooming in is terrible") - 2026-09-28

The rig had only ever zoomed around fit (1/24 -> 1/12). New rig mode `zoomin` (`node perf.cjs
zoomin 16k <tag>`, ROWFIX=1, GPU idle `21 %, 1128 MiB`): Space + wheel from fit to past 1x, one
tick per frame, then the same zoom in PROMPT mode with a mask painted first.

| surface | fit -> ~1x | worst frame | main-thread long tasks |
|---|---|---|---|
| canvas (Mask tool), after Phase 2 | 0.68-0.89 s, 39 ticks | 53-293 ms (at mip level changes) | 0 |
| **Prompt preview** (`MpiMaskedImagePreview`: the ORIGINAL as two `<img>`, CSS transform) | **11.6 s**, 34 ticks | **2.69 s**, 10 stalls | **9.9 s** (`(program)` = native) |
| Prompt preview, same zoom again (already rastered at that scale) | 0.45 s | 13.5 ms | 0 |

Chromium re-rasters a transformed `<img>` at each new scale and re-decodes the 345 MB PNG to do
it (~2.5 s a step). So Fabio's slow zoom is the Prompt preview, and its fix is the display copy
(Phase 3): the preview must show the 4096 display copy too, not only the canvas. Not a Phase 2
regression - the preview is untouched by Phase 2.

### Rig re-measure, GPU BUSY

Pending: needs the GPU. At 12:40 the GPU lease was held by a pod smoke
(`smoke-workflows.mjs --flows all`, since 12:18) and local util sat ~30 %, so neither a clean idle
nor Fabio's busy (local video) run could be taken. The rig now also runs the stroke A/B
(`STROKE_AB=1`: same strokes with only the overlay backing shrunk to 4096^2) and a CPU profile +
long-task total per stroke rep.

## Phase 3 (display copy) - 2026-09-28, session efbca418 (uncommitted on master `c4bb6a88f`)

### What changed

- Server: `GET /display-image?path=&edge=` (`resolveDisplayImage`, `routes/projects.js`) answers
  `{ url, width, height }`. At or under `edge`, `url: null` (load your own URL, whose `&v=` the
  route never sees) and nothing is written. Over it: `.meta/<id>.thumb.fit<edge>.webp` (sharp
  `limitInputPixels: false`, `.rotate()`, fit inside), made on first request, stamped with the
  original's mtime and re-made on any other stamp, written aside and renamed; the `.thumb.` infix
  puts it under `DERIVATIVE_RE`, Manual Cleanup and the delete paths. Owner id from a sidecar scan
  (big images only), remembered and re-checked. No sidecar -> the original + one `app.log` line.
- `services/ffmpegThumb.js`: `sharp.cache({ files: 0 })`. libvips kept WebP inputs OPEN on
  Windows (EBUSY on delete/overwrite; JPEG/PNG released) - measured with a probe
  (`scratchpad/lockprobe2.cjs`), and it failed the unit test's re-make before the fix.
- Renderer: `js/utils/displayImage.js` (`displayMaxEdge()` = D1, `setDisplayMaxEdge` for specs,
  `resolveDisplayImage(url)`). `MpiCanvas`: `this.img` = the drawn pixels, `_displayImage()` =
  the NATURAL size (`_natural`), every dimension site reads it (managers, `drawStroke` k, Place k +
  raster, compare cover-fit); backing capped at `_backingEdge()` on both sizing twins (D5) with the
  stack + canvas CSS boxes at natural px (they were set to the backing, wrong above
  MAX_TEXTURE_SIZE); the mip level counts the backing stretch (`_baseDevScale`). Compare side
  loads its copy too. `MpiMaskedImagePreview` loads the copy, stack sized to natural.
- Found on the way, fixed here:
  - `loadImage` mode resets moved back to CALL time (they had drifted after the new fetch await,
    so a tool picked during the fetch was reset to none).
  - A second load of the image already loading JOINS it (canvas and preview). The viewer loads its
    entry twice on mount; with the fetch the two always overlapped and the first caller's chain
    hung on a superseded load. A load of ANOTHER image still supersedes (never settles, as before).
  - `MpiCanvasViewer` swaps run in turn (`_inTurn`). Pre-existing race: the rail does not wait,
    `swapToPreview` awaits the persist before the preview exists, so a Mask pick in that window
    no-op'd `swapToCanvas` and the preview mounted over a rail on Mask. Diag spec (open an entry
    remembered in Prompt, pick Mask at once), 6 reps each: HEAD 2/6 stuck in Prompt, Phase 3
    before the fix 5/6, with the fix 6/6 on both HEAD's renderer and Phase 3
    (`scratchpad/headdiag.py`; diag spec deleted).

### Checks (all run 2026-09-28)

- Unit: `node --test tests/canvas-display-rendition.test.cjs` 3/3 (a no-copy still; a
  32768x8200 EXIF-6 JPEG past sharp's pixel limit -> 8200x32768 natural, copy 1025x4096, swept by
  `DERIVATIVE_RE`, cached, re-made ONCE for an original dated an hour ahead; a stray big file ->
  the original). `npm test`: 2204 tests, 2202 pass, 0 fail. `npx eslint` on every touched file:
  clean.
- New `tests/desktop/canvas-display-copy.spec.js` (one 2048^2 gradient imported twice; entry A
  worked uncapped, cap forced to 1024, entry B given the same real-pointer mask stroke, paint
  stroke, Place and crop): canvas and preview draw `<id>.thumb.fit1024.webp`, base/overlay
  backing 1024 in a 2048px box, same screen box, mask/paint/place PNGs 2048^2 and byte-equal,
  crop rect equal. 6/6 (`--repeat-each=6`). **Mutation proof** (`scratchpad/mutate.py`, file
  restored byte-equal): mask sized off the copy -> FAILS (dims); stack CSS = backing -> FAILS
  (layout); Place raster off the copy -> FAILS (dims).
- `canvas-downscale-quality` (MPI-957) waited for an 8192 backing, now capped by design: it
  lifts the cap to 8192 so it keeps testing the mip over a large native backing. Pass.
- Desktop list: history-modes, mask-colour, mask-persist-roundtrip, canvas-downscale-quality,
  compare-native-resolution, crop-resize-output, stack-crop, gif-cutout, canvas-pan-no-repaint,
  canvas-display-copy, stack-history, history-list-thumbs, gif-transform -> 21/21 (20 + the
  downscale rerun).

### Rig, GPU IDLE (`scratchpad/rig3`, `node perf.cjs full|zoomin <t> p3-idle*`, no ROWFIX)

nvidia-smi before each run: `9-25 %, 1285-1331 MiB` (Fabio's app + ComfyUI open, no job; lease
free). Window 1280x800 DPR 1 -> cap 4096.

| step | before Phase 3 (MPI-963 `validation.md` / § Phase 2 / § Zoom IN) | Phase 3 |
|---|---|---|
| 16K open: pixels on screen, FIRST open (copy made, 16K sharp ~4 s server-side) | 6.5 s | 4.7 s |
| 16K open: pixels on screen, copy cached | 6.5 s | **0.71 s** |
| 16K open: longest main-thread block | 3.55 s | **0.19 s** |
| 16K Crop -> Mask / Mask -> Paint | 32 / 34 ms | 40 / 55 ms |
| 16K Paint -> Prompt | 2.1 s | **0.20 s** |
| 16K Prompt -> Mask | 4.3 s (2.39 s block) | **0.38 s** (0.18 s block) |
| 16K pan / wheel / stroke 3x3 s | 75 / 75,34,39 / 75 fps | 75 / 75,73,75 / 75 fps |
| 16K canvas zoom fit -> 1x | 0.68-0.89 s, worst 293 ms | 0.53-0.55 s, worst 40 ms |
| 16K **Prompt preview** zoom fit -> 1x | **11.6 s**, worst 2.69 s | **0.63 s**, worst 107 ms (again: 0.45 s, 13.5 ms) |
| 16K GPU dedicated: Mask / Mask again | 3218 / 3234 MB | **367 / 500 MB** |
| 16K GPU process private: Mask again | 3490 MB | 1045 MB |
| 32K open | never (blank, `img.onerror`) | **opens: 2.8 s first open**, 75 fps pan/wheel/stroke, 365 MB in Mask |

### Rig, GPU BUSY (Fabio's local video running; `p3-busy-video`, copy cached)

nvidia-smi `100 %, 13.4-14.0 GB` at start and at every snapshot but one (`11 %, 8.9 GB` at
`memBackToPrompt`, a lull in the job); zoomin run `100 %, 4.2-12.7 GB`. Same rig, 16K. This run also
stands in for Phase 2's busy re-measure. Before = Phase 1 § GPU BUSY (16K as-is / rowfix).

| 16K step, GPU busy | Phase 1 busy (as-is / rowfix) | Phase 3 busy |
|---|---|---|
| open: pixels on screen | 21.4 s / 7.4 s | **0.70 s** |
| open: longest main-thread block | 3.6 s / 2.65 s | 0.23 s |
| `draw()` to next frame | 322 / 189 ms | **13.4 ms** |
| wheel zoom 3x3 s | 4.6/2.2/3.2 / 4.8/2.5/3.0 fps | **75 / 75 / 75** |
| pan 3x3 s | 3.7/2.5/2.5 / 3.8/3.9/2.6 fps | **75 / 75 / 75** |
| mask stroke 3x3 s | 2.7/2.5/2.9 / 5.7/2.5/4.3 fps | **74.3 / 75 / 75** (max frame 27 ms) |
| Crop -> Mask / Mask -> Paint | 4.4 s / 1.1 s ; 69 ms / 0.9 s | 50 / 45 ms |
| Paint -> Prompt | 15.2 s / 5.0 s | **0.21 s** |
| Prompt -> Mask | 12.4 s / 6.6 s | **0.35 s** |
| canvas zoom fit -> 1x | - | 0.52 s, 75 fps |
| Prompt preview zoom fit -> 1x | (idle: 11.6 s) | 0.65 s, worst 120 ms (again 0.45 s, 75 fps) |
| GPU dedicated: Mask / Mask again | 2217 / 1208 MB ; 3160 / 1119 MB (paged) | 350 / 504 MB |

### Fabio (user-ux) - 2026-09-29, his app relaunched, local video generating

"All right, it worked ... timings are much better. It's now actually workable." Screenshot: the
32K (`imported_002`, 32768x32768) open in Mask, zoomed far in, strokes on it. Two findings:

- **The 32K's prompt-box chip was a broken image** - the chip `<img>` mounted the ORIGINAL (same
  class as MPI-963). Fixed here: `GET /project-thumb?path=` (`projectThumbFor`: the sidecar thumb,
  the original only without one) and the chip's `thumbSrc(url)`. Unit test added (4/4);
  `media-picker-to-history` 5/5. Not yet eye-checked.
- **Mask edges are very soft on the 32K** ("hard to create a good mask ... it needs to be
  sharp"). Not Phase 3: every mask layer works at `MASK_MAX_EDGE` 1536 on any image
  (`docs/masking.md`), so one mask px = 21x21 image px on a 32K (10.7 on a 16K) - same before this
  phase; exports are upscaled from it, so the model gets the soft edge too. Design B kept the 1536
  cap; Fabio now wants sharp. Raised to him as a decision (below Phase 3's scope).

## Mask cap trial: `MASK_MAX_EDGE` 1536 -> 4096 - 2026-09-29, session d8530578 (uncommitted on `08a1ccab1`)

Fabio: "try the 4096 approach ... if the mask is good enough, we are sorted" (the 4K image already
runs smooth). Rig: `research/rig/perf.cjs mask <16k|32k> <tag>` (new mode: open -> Mask -> 3x3 s
circle strokes -> `fillMaskHoles()` -> Adjust `beginMaskAdjust` / first `previewMaskAdjust` / 3 s
slider drag / `applyMaskAdjust` / `undoMask` -> Paint -> Prompt -> Mask, mask coverage read before
Prompt and after the round trip), `msum.py <run>` summarises. Scratch copy, `gpu_lease.py run`,
GPU IDLE (nvidia-smi `3-29 %, 1.3-1.5 GB` at start; Fabio's app open, no job; a pod smoke had just
disconnected). Mask cap A/B had to be ON DISK: a Playwright `context.route` rewrite of
MaskManager.js crashed the renderer at boot even as a no-op (control run), so run 1 is HEAD.

Change: `MASK_MAX_EDGE = 4096` and `paint()` passes its dab's mask-px box to `_recomposite(rect)`,
which rebuilds only that box and skips the auto layer (it never reads the brush layers). Every other
caller still passes nothing = the full pass.

| 16K, GPU idle | 1536 (HEAD) | 4096 as-is | 4096 + dab-box recomposite |
|---|---|---|---|
| mask working size | 1536^2 (10.7 image px / mask px) | 4096^2 (4) | 4096^2 (4) |
| stroke 3x3 s | 74.6 / 75 / 75 fps | **27.5 / 27.4 / 29** (`restore` 1.7 s + `drawImage` 1.3 s self per rep) | **71 / 75 / 75** (one 147 ms first frame) |
| hole fill (`fillMaskHoles`) | 91 ms | void (the 28 fps circle never closed: no hole) | 246 ms |
| Adjust: first slider move (distance field build) | 190 ms | 1708 ms | **1730 ms, one block** |
| Adjust: slider drag 3 s | 75 fps | 25.7 fps | **27.5 fps** (40 ms frames) |
| Adjust Apply / undo of it | 21 / 24 ms | 97 / 217 ms | 65 / 91 ms |
| undo after Fill or Apply: MB / depth | ~18 MB an entry (not read) | 128 MB / **1** | 128 MB / **1** |
| Paint -> Prompt (ready) | 158 ms | 720 ms | 580 ms (`toDataURL` 206 ms) |
| Prompt -> Mask (ready) | 254 ms | 486 ms | 428 ms (one 257 ms block) |
| mask coverage before Prompt = after round trip | 0.10032 = 0.10032 | 0.00275 = 0.00275 | 0.10003 = 0.10003 |
| renderer private / GPU dedicated, Mask | 264 / 362 MB | 428 / 477 MB | 426 / 478 MB |

32K + dab-box recomposite (mask 4096^2 = 8 image px / mask px, was 21): stroke 70.3 / 75 / 75 fps,
hole fill 303 ms, Adjust first move 1879 ms, drag 27 fps, Apply 74 ms, undo 128 MB / depth 1,
Paint -> Prompt 650 ms, Prompt -> Mask 488 ms, round trip coverage equal, renderer 427 MB.

What it says:
- Strokes: 4096 is fine ONLY with the dab-box recomposite (28 -> 75 fps). The mask is 4096^2 on any
  image at or over 4096, so a plain 4K photo pays exactly this too.
- **Undo regression:** one Fill / Adjust Apply / Clear / Add at 4096 is two full 4096^2 RGBA
  layers = 128 MB, over `UndoStack`'s 96 MB budget, and eviction keeps only the newest entry - so
  that one op wipes every stroke before it from Ctrl+Z (1536: ~18 MB, about 5 such ops fit).
- **Adjust:** the first slider move freezes ~1.7-1.9 s (distance field over 16.7 M px) and the drag
  runs ~27 fps (full range pass + 64 MB `putImageData` per tick). Paint's Adjust already costs this
  at its 4096 cap.
- The Grow/Shrink slider max is 50 mask px (`MpiToolOptionsMaskAdjust` `MAX_R`), so its reach in
  image px shrinks by 4096/1536: 16K 533 -> 200 px, 4K 133 -> 50 px.
- `distanceField.js`'s "well inside Float32's exact-integer range" note is false at 4096 (max d^2
  33.5 M > 16.7 M) but harmless: every threshold is <= 50^2 + 1, far below where Float32 rounds.

Checks: unit (the 10 suites importing MpiCanvas / MaskManager / UndoStack) 141/141; `npx eslint`
MaskManager.js clean; desktop mask-colour, mask-persist-roundtrip, mask-temp-ipc,
canvas-display-copy, canvas-pan-no-repaint, history-modes, colour-pick-eyedropper, gif-cutout,
gif-workspace (brush over a GIF base layer) 26/26.

### Fabio's check 1 (2026-09-29) and round 2

Fabio (his app, 4096 + dab-box): "enough precision for the mask" - **4096 stays**. Found:
(1) **Grow / Shrink / Edge dead after switching History entry** (with a preview pending) until he
left History and came back; (2) the first slider move "takes quite a while"; (3) Grow looks
"pixelated" (screenshot: the 4K entry at ~4x zoom - the green preview's steps are exactly one
image px, the same blocks as the image under it; the grow result is binary, the brush dab is
antialiased; at 1536 the same edge was a 2.7x-upscaled blur); (4) SAM3 on the 16K fails in
MpiLoadImage (Pillow bomb limit) = MPI-971, already filed.

Root cause of (1): History reuses ONE canvas across entries; `loadImage()` -> `MaskManager.init()`
-> `endAdjust()` dropped the Adjust session, but the Adjust panel stays mounted and calls
`begin` only at mount, so `previewAdjust()` found no pristine snapshot and returned false forever.
Same shape as MPI-454's Place bug. `PaintManager.init()` had the twin.

Round 2 changes: `init()` re-opens an open session and every layer load re-snapshots it (both
twins); mask Adjust field over the mask's box (`fieldOverContent`, paint's MPI-445 method), padded
to the slider's end; mask slider max 50 -> 133 mask px (same image reach as 50 at 1536; paint
stays 50 image px); layer-wide one-shots in Mask/Paint open a capture (`_recordUndo()` ->
`undo.begin`) and close it with `_commitUndo()` -> `UndoStack.commitChanged()`, which keeps only
the diff box (none = no entry); UndoStack scratch canvases are CPU-backed (read back by the diff).

| GPU idle, 4096 | 16K round 1 | 16K round 2 | 32K round 2 |
|---|---|---|---|
| stroke 3x3 s | 71 / 75 / 75 (147 ms first frame) | **75 / 75 / 75** (max 13.6 ms) | 70.3 / 75 / 75 |
| hole fill | 246 ms | 414 ms (diff scan) | 481 ms |
| undo after Fill: MB / depth / entry | 128 / **1** / 128 MB | **64 / 4 / 15.7 MB** | 64 / 4 / 15.8 MB |
| Adjust first slider move | 1730 ms | **330 ms** | 316 ms |
| Adjust drag 3 s | 27.5 fps | **74.3 fps** | 73 fps |
| Apply / undo of it | 65 / 91 ms | 256 / 93 ms | 257 / 89 ms |
| undo after Apply: depth / entry | 1 / 128 MB | **5 / 16.3 MB** | 5 / 16.2 MB |
| Paint -> Prompt / Prompt -> Mask | 580 / 428 ms | 464 / 418 ms | 483 / 428 ms |
| round trip coverage | equal | equal (0.10003) | equal (0.09938) |

(The rig's mask is a filled ring about a third of the frame across; a frame-filling mask still
pays the whole-layer field, ~1.7 s then ~27 fps.)

Checks: `tests/desktop/mask-adjust-entry-switch.spec.js` (new: two entries in one card, Mask
Adjust with a Grow preview pending, switch entry, nudge the real slider, preview must come up,
switch back, Apply) **FAILS on the round-1 tree at the post-switch preview, passes after**. Unit:
the 10 suites 145/145 (new: `commitChanged` box + no-change, every `_recordUndo()` closed by
`_commitUndo()` in both managers - mutation-proved: dropping `PaintManager.clear`'s commit fails
it, file restored byte-equal - and the init/load re-snapshot guard on both twins). eslint clean.
Desktop: the 9 specs above + the new one, 27/27.

**Fabio verified round 2 (2026-09-29): "1, go with both your picks"** - (a) a soft Grow / Shrink /
Edge edge on the mask, (b) SAM3 on the 4096 copy with scaled points (MPI-971's SAM3 half).

### Round 3: soft Adjust edge + auto-mask on the 4096 copy

- `distanceField.writeRangeSoft()`: grow / band keep every hard pixel opaque and add a 1 px fringe
  (alpha = o + 1 - d); shrink softens the kept rim (alpha = d - e) so alpha > 0 is EXACTLY the hard
  result. Mask `previewAdjust` uses it; paint keeps `writeRange` (MPI-440 hard cut). Export (any
  alpha = masked) grows by at most the 1 px fringe on grow / band, like a brush dab's AA.
- `runAutoMask` (all three branches: points, text, detector) sends `resolveDisplayImage(url, 4096)`
  - the server's `.thumb.fit4096.webp`, the same copy the canvas draws on a 1080p/1440p screen - and
  scales the click points by 4096 / long edge. A source <= 4096 goes exactly as before. The masks
  come back at the copy's size; the mask layer (4096) scales picks to its own size.

Checks: new `tests/auto-mask-display-copy.test.cjs` (real `runAutoMask`, `/display-image` + engine
stubbed): 32K -> copy URL + points (16384,8192)->(2048,1024) etc.; 4096 -> original + points
untouched; 16K text run -> copy. **On HEAD's commandExecutor.js: 2 of 3 FAIL** (the big-photo
cases), the <= 4096 control passes; with the change 3/3 (`scratchpad/head_ce.py`, restored
byte-equal). New `writeRangeSoft` unit test (grow 5, shrink 4, band 3/2, band 4/0 on a disc: hard
pixels opaque, fringe < 255 and white, shrink alpha>0 == hard, fringe within r+1) + a source guard
(mask previews soft, paint never). Unit: 14 suites 184/184 + the guard file 11/11. Desktop 27/27.
Rig 16K idle (`f4096-soft`): stroke 71.6 / 75 / 75, Adjust first move 332 ms, drag **70 fps**
(74.3 before the soft write), Fill 417 ms, Apply 254 ms, undo depth kept.
**Not verifiable here:** SAM3 actually running on the copy needs an engine with SAM3 - Fabio's check.

**Fabio verified round 3 (2026-09-29, his app restarted):** "All passed, and mask adjust is much
faster now" - SAM3 points + text on the 16K and 32K run (no Pillow error), soft Adjust edge, Adjust
speed.
