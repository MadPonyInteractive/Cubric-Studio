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
- 2026-09-30 D9 + R1 wiring (d46a8d69): `node --test tests/routine-model.test.cjs tests/routine-runner.test.cjs
  tests/agent-pinned-settings.test.cjs tests/agent-mask-dispatch.test.cjs` 79 pass / 0 fail (D9: a legal reference +
  `{text}` routine, 13 save refusals, a Flow-field placeholder; runner: inputs filled identically on every card with
  the card still in the required slot, a card-id input, `INPUT_MISSING` / `INVALID_INPUT` before any queueing, quote
  refusal; denoise forwarded). `npm test` (Git Bash) 2366 pass / 0 fail / 2 skipped. ESLint clean on the four files.
  LIVE, own isolated app on the :48188 engine under gpu_lease (queue empty before): downscale -> klein-4b kleinEdit
  (character card as `inputImage2`, `{mood}`) -> Scribble Flow on 2 cards = one settled stack of 2, 3 versions each,
  `/get-project` on disk == live, input cards untouched, 71 s; the edit's sidecar holds the filled prompt ("warm
  golden-hour") and the character as `inputImage2`. A first run stopped one card at step 1 with `ALREADY_SMALLER`
  (D3 as designed), stack of 1.
- 2026-09-30 D10 + R2 + W1 routes (bd66b68e): `node --test tests/routine-runner.test.cjs` 14/14 (3 new D10: step 1
  skipped -> next step makes the new card and it still joins the stack; a later skip makes no version; nothing to do
  anywhere refuses, no stack); `tests/connector-routines.test.cjs` 5/5 (save checked by the app and stored AS
  CHECKED, refused save stores nothing, quote/run carry the STORED routine + cards + inputs + folderPath, global scope,
  400 without folderPath); store list carries `inputs`. `npm test` (Git Bash) 2375 pass / 0 fail / 2 skipped; ESLint
  clean on the 7 files. LIVE, own isolated app (port 62823, never :3000) on the :48188 engine under gpu_lease, queue
  empty, project CLOSED, driven by a scratch script over the connector only: save (+ an UNKNOWN_FLOW save refused by
  the app's check), list, quote (`count: 3` = a stack of 2 expanded + 1 card), run `shrink-and-square` (downscale
  0.5 MP -> crop 1:1) = one new stack of 3, 2 versions each, 1.3 s. First try exposed a real bug (fixed): a closed
  project's `/get-project` history is item ids, so the runner answered CARD_NOT_FOUND - `routineDeps.readProject` now
  hydrates a closed project via `reconcileAndHydrate` (an imported card has no sidecar). D10 live: the same routine on
  that result stack (squares now under 0.5 MP) -> every card `skipped: [1]`, crop made each new card, stack of 3. Both
  closed-project stacks read `expected` until the project opened, then settled on open (by design, `project:changed`);
  screenshot `shot-r2-gallery.png` (scratchpad bd66b68e).
