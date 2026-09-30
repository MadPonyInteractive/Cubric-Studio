# MPI-970 validation

Verify mode: user-ux for Phase 5 F2 only; Phases 1-4 auto (plan.md § Verification).

## Evidence

- 2026-09-29 Phase 1 spike (c4eb2969), live in an own isolated Electron (own profile/port/Documents, CDP-driven,
  jobs on the shared :48188 engine under a GPU lease): S1 one card, 5 steps (resize, crop, imageUpscale, klein-4b
  i2i, Scribble Flow via an in-page passthrough) = 1 new card with 5 History versions; S2 closed project = new
  card + version 2, survives an open; S3 2 cards x 3 steps = 1 stack of 2, 3 versions each, settled on drain.
  Evidence lines: plan.md § Phase 1 findings. Spike code stayed in the scratchpad; no product file changed.
- 2026-09-30 Foundations batch (26163994, two parallel workers, then re-run by the orchestrator):
  `node --test tests/routine-model.test.cjs tests/agent-routines-store.test.cjs` -> 44 pass / 0 fail (T1 30:
  a legal 3-step chain, every refusal code, image->video->image `MEDIA_KIND_BREAK`, t2i `NOT_BATCHABLE` first and
  later; T2 14: write/list/read/overwrite/delete in both scopes, the 50 cap incl. overwrite at the cap, bad slug,
  `NOT_A_PROJECT`, a double delete keeping both copies). `npm test` from Git Bash: 2336 pass / 0 fail / 2 skipped.
  (Run from PowerShell, `tests/pre-push-done-gate.test.cjs` fails 7 because `bash` there resolves to WSL - shell,
  not code.)
- 2026-09-30 R1 core (26163994): `node --test tests/routine-runner.test.cjs tests/routine-model.test.cjs
  tests/history-completion-live-card.test.cjs` green; `npm test` (Git Bash) 2347 pass / 0 fail / 2 skipped. Not yet
  live: the runner has no renderer `deps` until the agentDispatch split + routineDispatch.js land.
