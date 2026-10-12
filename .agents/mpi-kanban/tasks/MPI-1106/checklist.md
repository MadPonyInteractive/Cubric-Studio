# MPI-1106 checklist

CPU half (rides MPI-1104's `runCpuJob`):
- [x] Agent GIF verbs (`gif.make`, `gif.edit`, `gif.to-video`, `sheet.make`) show a Transfers row while they run
- [x] `gif.cutout`: its encode and apply steps show a Transfers row
- [ ] Gallery right-click Make GIF shows a Transfers row - blocked: MPI-623 claims `MpiGalleryBlock.js`

GPU half (needs Fabio's call, refactor; MPI-623 claims `commandExecutor.js`):
- [ ] The cut-out mask run (`runGifCutoutTrack`) goes through `enqueueGeneration`
