# MPI-796 checklist

- [x] Two new Resolution Types in `MpiToolOptionsResize`: MP (target megapixels, number input) and SCALE (divide source by 1.5 / 2 / 3 / 4).
- [x] Width/Height derived from the source size, keep aspect; shown read-only so the user sees the result.
- [x] Recompute when the source item changes.
- [x] New keys never reach the workflow (resize.json / resize_video.json have no matching Input_ titles; verified).
- [x] Unit test for the dims maths.
- [x] Live check on an isolated app: MP and SCALE Apply produce the expected size.
- [x] `npm test` green.
