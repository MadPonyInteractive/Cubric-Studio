# MPI-771 Checklist

Derived from `tasks/MPI-757/plan.md` (2026-09-16).

- [x] Engine half (MPI-757 Batch 2 worker)
- [x] Engine verify: tests/gif-cutout.test.cjs + one real local track
- [x] UI half (MPI-757 Batch 3)
- [x] Redesign per Decision 14 (Phase 3b): base layer, per-frame masks, Mask Brush, Track All / Single Frame - automated checks green
- [x] Fabio's six findings from the first eye check (2026-09-16 13:10Z) - automated checks green
- [x] Fabio's second check (2026-09-17): held thumb overshoot, native-drag "copy" + stuck Discard, preview button in the Mask Brush - automated checks green; Discard stays frames-only (Fabio: a)
- [ ] types.js typedef hunk (blocked on MPI-737 claim; text in types-hunk.md)
- [x] UI verify: local engine AND RunPod (user-ux) - local 2026-09-17 ("1"), RunPod 2026-09-17 (Fabio's app, RTX 2000 Ada)
- [x] Header ENTRIES count refetches after a GIF tool Apply (found in the RunPod check screenshot)
- [x] Fabio's UI pass (2026-09-17 ~14:00Z): Cut out saves transparent; `colours` stored as 0 (3 routes); checkerboard behind frames; spinner + status bar while masking; masks survive Cut out (per-list stash); "name what to KEEP" hint; cut-out records its settings
- [x] Mask methods: Remove background (BiRefNet, default), By name (SAM3), By colour (shared `js/utils/colourKeyMask.js`); runner hunk waits on MPI-774's commandExecutor.js claim (message 4463a29e)
- [x] By colour in the IMAGE mask tools (Fabio, 2026-09-17)
- [ ] Fabio's UI check of the above after a full app restart
