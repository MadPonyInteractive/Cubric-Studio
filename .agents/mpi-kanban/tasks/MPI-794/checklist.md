# MPI-794 checklist

MPI-787 follow-up. The tester whose brush crawled has a 12 GB RTX 30-series card, which should
draw 2D canvas on the GPU. Nothing in `app.log` says whether Chromium actually did, or which
adapter it picked, so the next report cannot answer it.

## Measured before building (Electron 41.1.1, this box: RTX 4060 Ti + Intel UHD 770)

- `app.getGPUFeatureStatus()` reads `disabled_software` for EVERYTHING until the GPU process is
  up, even with acceleration on. It turns truthful at the first `gpu-info-update` (~250 ms
  after ready; ~80 ms with acceleration off).
- `getGPUInfo('basic')` lists adapters but never marks one `active`.
- `getGPUInfo('complete')` does: `active` plus `auxAttributes.glRenderer`, e.g.
  `ANGLE (NVIDIA, NVIDIA GeForce RTX 4060 Ti ... D3D11-...)` on the GPU and
  `ANGLE (Microsoft, Microsoft Basic Render Driver ...)` / `angle=d3d11-warp` in software.
  Resolved in ~0 ms when called at that first update.

## Steps

- [ ] `main.js`: one `[gpu]` line at the first `gpu-info-update`: canvas / compositing /
      raster status, the ANGLE renderer, the active adapter + driver, all adapters
- [ ] `main.js`: on `child-process-gone` with `type: 'GPU'`, a warn line with reason + exit
      code, then the same status line once Chromium has relaunched it
- [ ] Live check: the line lands in a real run's `app.log` (acceleration on and off)
- [ ] `docs/DEVELOPMENT.md`: name the line in the app.log section
