# MPI-970 validation

Verify mode: user-ux for Phase 5 F2 only; Phases 1-4 auto (plan.md § Verification).

## Evidence

- 2026-09-29 Phase 1 spike (c4eb2969), live in an own isolated Electron (own profile/port/Documents, CDP-driven,
  jobs on the shared :48188 engine under a GPU lease): S1 one card, 5 steps (resize, crop, imageUpscale, klein-4b
  i2i, Scribble Flow via an in-page passthrough) = 1 new card with 5 History versions; S2 closed project = new
  card + version 2, survives an open; S3 2 cards x 3 steps = 1 stack of 2, 3 versions each, settled on drain.
  Evidence lines: plan.md § Phase 1 findings. Spike code stayed in the scratchpad; no product file changed.
