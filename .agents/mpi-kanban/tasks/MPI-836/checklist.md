# MPI-836 checklist

- [ ] Block: ONE ranged-frames source (`gifControlBar.getRange()` over `viewer.getFrames()`); output, preview, crop, resize, reverse, GIF to Video and cut-out all take it
- [ ] Cut-out Apply slices `frames` AND `masks` by the same range
- [ ] GIF output panel gains Frame rate + Loop count, seeded from the ENTRY (never a saved 10 fps silently retiming a GIF); a mixed-delay GIF keeps its timing until a rate is typed
- [ ] Output note says which frames Apply keeps
- [ ] Rail: Timing group (Trim, Speed, Loop count) removed; registry, labels and the trim-only toast go with it
- [ ] `tests/desktop/gif-timing.spec.js` rewritten for the one panel + a ranged Apply per op
- [ ] `docs/gif.md` § Timing and output tools
- [ ] Ask Fabio before touching `.claude/rules/` component maps (CLAUDE.md rule 5)
