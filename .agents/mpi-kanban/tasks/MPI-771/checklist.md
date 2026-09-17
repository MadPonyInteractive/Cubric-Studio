# MPI-771 Checklist

Derived from `tasks/MPI-757/plan.md` (2026-09-16).

- [x] Engine half (MPI-757 Batch 2 worker)
- [x] Engine verify: tests/gif-cutout.test.cjs + one real local track
- [x] UI half (MPI-757 Batch 3)
- [x] Redesign per Decision 14 (Phase 3b): base layer, per-frame masks, Mask Brush, Track All / Single Frame - automated checks green
- [x] Fabio's six findings from the first eye check (2026-09-16 13:10Z) - automated checks green
- [x] Fabio's second check (2026-09-17): held thumb overshoot, native-drag "copy" + stuck Discard, preview button in the Mask Brush - automated checks green; Discard stays frames-only (Fabio: a)
- [ ] types.js typedef hunk (blocked on MPI-737 claim; text in types-hunk.md)
- [ ] UI verify: local engine AND RunPod (user-ux)
