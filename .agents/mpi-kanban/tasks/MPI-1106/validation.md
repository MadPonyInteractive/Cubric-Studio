# MPI-1106 validation

2026-10-12, session 2001b3f5 - CPU half:

- `js/shell/gifJobs.js`: `gif.make`, `gif.edit`, `gif.to-video`, `sheet.make` run inside
  `runCpuJob` (MPI-1104), so each is a Transfers row with the sweep while it runs. `gif.cutout`
  wraps only its two CPU steps (`/gif-cutout/source`, `/gif-cutout/apply`); its mask run is GPU.
- `node --test tests/connector-gif-jobs.test.cjs tests/cpu-jobs.test.cjs` - 26 pass. New case:
  the row exists during `/gif/make` and is gone after a success AND after a route failure.
- `npx eslint js/shell/gifJobs.js` - clean.

Open:
- Gallery right-click Make GIF (`MpiGalleryBlock.js` make-gif handler): NOT done. MPI-623
  (session cdb2fd5e) holds a live write claim on that file with uncommitted work. The change is
  one wrap of the `/gif/make` fetch in `runCpuJob('Making a GIF', ...)` once it is released.
- GPU half: `runGifCutoutTrack` outside the generation queue - waits on Fabio's call (refactor)
  and on MPI-623's claim on `js/services/commandExecutor.js`.
