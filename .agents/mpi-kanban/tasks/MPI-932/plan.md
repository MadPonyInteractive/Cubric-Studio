# MPI-932 Plan - Finish the mascots, then fix the cancel path (umbrella)

Fabio, 2026-09-25: one umbrella, one line of handoffs, carried to done. Each session picks the
next open member below, moves THAT card todo -> doing (with files.json), briefs Fabio, works it,
and ticks it here. Every handoff points at this plan.

## Current State

(2026-09-26, session 667f09c0) Phases 1-2 done: MPI-908 and MPI-906 closed. Phase 3a built:
MPI-930 + MPI-931 (pre-register Stop remembered; every interrupt names its prompt_id), spec
tests/desktop/cancel-targets-own-prompt.spec.js red-then-green, 41 related specs green. Waiting on
Fabio's live check, then CI, then close both. Next after that: MPI-929 + MPI-928 together.

## Members, in order

### Phase 1: close what is finished
- [x] MPI-908 Mascots on empty and one-off states - CLOSED ab86625b (2026-09-25).

### Phase 2: the last mascot spots
- [x] MPI-906 Mascots on the waiting spots - CLOSED 2026-09-26 (code 86af0aeb, CI green).

### Phase 3: the cancel path (one owner, assigned by Fabio via peer "Agent integration plan 2")
- [ ] MPI-930 A local cancel before register settles nothing -> agent/MCP hang 30 min.
      BUILT 2026-09-26, awaiting Fabio's live check.
- [ ] MPI-931 Stop interrupts whatever the shared engine runs. ComfyUI v0.34 takes prompt_id on
      /interrupt (yes). BUILT 2026-09-26, awaiting Fabio's live check.
- [ ] MPI-929 Cancel mascot silent for cloud jobs. Research; reproduce first.
- [ ] MPI-928 Cloud Stop bills and drops the output. DECIDED (Fabio 2026-09-25): option A - the
      paid result lands as a card marked already charged (like the local R09 path). Planned;
      do it with MPI-929 (same Stopped-placeholder path).
MPI-930 and MPI-931 share commandExecutor.js - do them in ONE session, never in parallel.

### Phase 4: close the mascot umbrella
- [ ] MPI-909 Prompt box head peeks - BLOCKED on the MpiPromptBox.js/.css claim (peer da9175f5
      at the time of writing). Re-check the claim; if still held, ask Fabio or the owner.
- [ ] MPI-842 Mascot crew identities (`idea`) - ask Fabio whether it is still wanted or folds
      into what shipped.
- [ ] Close MPI-846 (the mascot umbrella) once its members are done or dropped; then close this.

## Constraints

- An `npm run app:isolated` instance SHARES Fabio's ComfyUI on :48188 - a cancel test there can
  kill his renders. Check the engine queue is empty before any cancel test.
- A cloud (DeepInfra) Stop cannot un-bill: the provider finishes and charges; the route saves the
  output to %TEMP%/cubric-deepinfra (24 h sweep). A successful DeepInfra run logs nothing.
- The live app log is %APPDATA%\Cubric Studio\logs\ (CLAUDE.md still says Cubric Vision - ask
  Fabio before fixing CLAUDE.md).

## Verification

**Verify mode:** user-ux (per member: each card's own spec, then Fabio checks it live).

## Completed

## Plan Drift
