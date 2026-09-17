# MPI-772 Checklist

Derived from `tasks/MPI-757/plan.md` § Phase 4 (2026-09-17).

- [x] Timing panel `MpiToolOptionsGifTiming` (Trim, Speed, Reverse, Loop count, GIF output), rail groups, Block wiring
- [x] Control bar exposes the trim range (`getRange()`)
- [x] `tests/desktop/gif-timing.spec.js`: each tool on a real GIF, sharp read-back, frame store unchanged
- [x] Existing GIF desktop specs + `npm run lint:components` + node suite green
- [x] Docs: `docs/gif.md`
- [ ] types.js typedef + preloadStyles.js line (peer claims; text in `types-hunk.md`)
