# MPI-795 checklist

Root cause: `_enqueueToolUpdate` seeds `toolSettings.crop` as `{}` and writes only the keys the user touched; `getToolSettings` returns that partial object INSTEAD of the defaults, so `_runCrop` saw `res_w`/`res_h` undefined whenever one was left at the panel's displayed default, and never resampled. Second defect: apply read the persisted copy, which trails the panel by ~500ms (200ms panel debounce + 300ms queue).

- [x] `getToolSettings` merges stored keys over defaults; sweep every caller.
- [x] Crop panel sends its live settings with `apply` (image + video-save); block passes them through; `_runCrop` / `_handleCropSaveVideo` use them.
- [x] Unit test for the merge.
- [x] Live check on an isolated app: RESOLUTION with one dimension left at its default, box resized, Apply -> output is exactly W x H.
- [x] `docs/crop.md` note.
- [x] `npm test` green.
