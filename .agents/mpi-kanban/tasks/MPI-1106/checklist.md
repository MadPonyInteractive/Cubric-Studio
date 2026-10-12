# MPI-1106 checklist

CPU half (rides MPI-1104's `runCpuJob`):
- [x] Agent GIF verbs (`gif.make`, `gif.edit`, `gif.to-video`, `sheet.make`) show a Transfers row while they run
- [x] `gif.cutout`: its encode and apply steps show a Transfers row
- [x] Gallery right-click Make GIF shows a Transfers row

GPU half (Fabio approved all three callers, 2026-10-12):
- [x] The cut-out mask run (`runGifCutoutTrack`) goes through `enqueueGeneration` (`enqueueMaskTrack`)
- [x] Agent `gif.cutout` uses it
- [x] GIF Cut-out panel uses it (encode = Transfers row; By colour keeps its own status bar)
- [x] Video Mask panel uses it (encode = Transfers row)
- [x] Eye test in the app: both panels show a queue row, Stop works, masks land (Fabio, 2026-10-12)
- [x] GIF cut-out status bar is pink (image), not orange - fixed after the eye test
- [ ] Fabio's glance at the pink bar
