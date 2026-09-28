# MPI-961 research - lifecycle + measurement instrument (2026-09-28)

Condensed from two read-only Haiku investigators. **Code traces, not executed** - Phase 1 of the plan
measures them. Line numbers as of master `aa247d693`; cite by symbol, lines rot.

## Full-size copies alive with one image open (MpiCanvas.js)

| copy | size rule | allocated | freed |
|---|---|---|---|
| `this.img` (decoded original) | natural size | `loadImage` (`new Image`, onload) | replaced on next load; no `close` |
| `baseCanvas`, `overlayCanvas` | image, clamped to `MAX_TEXTURE_SIZE` (32768 on NVIDIA) | `_sizeImageCanvases`; video twin ~:600 | `destroy()` |
| `compareCanvas` | after-image, same clamp | `_drawComparisonLayer` | width=0 when compare ends |
| `_maskTintBuf` | overlay size | first inverted/auto/adjust mask draw (`_recolorMaskLayer`) | never (lives until destroy) |
| `_DisplayMip` x2 (MPI-957) | one pow-2 level down, only when zoom < 1/2 device px | `sync()` | width=0 when not needed |
| managers | mask 1536, paint 4096, comp 1536, place 8192 - from `this.img` dims (`mask.init(this.img.width, ...)` ~:497-506) | per load | per load |

No `img.decode()` / `createImageBitmap` on the load path; Chromium decodes on first `drawImage`.

## Repaint triggers

- `draw()` (full base + overlay + compare + screen UI): wheel zoom (`InputController` wheel ->
  `onDraw`), pan mousemove (`onDraw`), mode switch (`activeMode` setter), mask set/clear, grid,
  resize, video compare rAF loop. `onDraw` = `this._applyTransform(); this.draw();` (MpiCanvas.js ~:298).
- `drawStroke(box)` (clipped overlay): brush moves only (MPI-787).
- Hover: `onCursorDraw` (screen UI only).

## Instrument

- `npm run app:isolated` (`scripts/launch-instance.mjs`): own profile `%TEMP%\cubric-agent-profile`, own
  port, prints `READY <url>`, window parked off-screen (`CUBRIC_BACKGROUND=1`). **GPU ON**: `main.js`
  ~:258 adds `--disable-gpu` only under `CUBRIC_E2E`.
- The Playwright desktop harness (`tests/desktop/launch.js`) SETS `CUBRIC_E2E` -> GPU OFF -> never
  take perf numbers there (MPI-633 read 0.0 MB VRAM that way).
- VRAM: MPI-633 `validation.md` method - `app.getAppMetrics()` pids + Windows `\GPU Process Memory(*)`
  counters; one launch per config (the GPU pool does not release within seconds).
- FPS: MPI-787 `validation.md` method - one synthetic mousemove per rAF, 3 x 3 s strokes, mean fps +
  median frame ms. Its harness lived in a scratchpad (not committed).
- Off-screen window is NOT throttled like a backgrounded one (`docs/testing.md` ~:124-141, 77 fps).
- Open a project in the isolated instance: `POST /connector/open-project {folderPath}` on ITS port.
- Existing 16K fixture pattern: MPI-943 `tests/desktop/image-import-reduce.spec.js`; sharp 16K tests
  `tests/sharp-16k-inputs.test.cjs`.
