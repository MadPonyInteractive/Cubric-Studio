# MPI-932 Plan - Finish the mascots, then fix the cancel path (umbrella)

Fabio, 2026-09-25: one umbrella, one line of handoffs, carried to done. Each session picks the
next open member below, moves THAT card todo -> doing (with files.json), briefs Fabio, works it,
and ticks it here. Every handoff points at this plan.

## Current State

(2026-09-25, session bae9042a) Umbrella created. MPI-908 is fully verified and committed
(d66a472b) but still in `doing` - close it first. Next: Phase 1.

## Members, in order

### Phase 1: close what is finished
- [ ] MPI-908 Mascots on empty and one-off states - all verified; close via mpi-end-session
      (evidence in its validation.md).

### Phase 2: the last mascot spots
- [ ] MPI-906 Mascots on the waiting spots - left: Model Library queued install, History peek,
      starting-engine screen (see its checklist; float latent window dropped by Fabio).

### Phase 3: the cancel path (one owner, assigned by Fabio via peer "Agent integration plan 2")
- [ ] MPI-930 A local cancel before register settles nothing -> agent/MCP hang 30 min
      (commandExecutor.js exec.cancel ~1329). Planned.
- [ ] MPI-931 Stop interrupts whatever the shared engine runs (commandExecutor.js ~1336, ~1396;
      does the pinned ComfyUI take a prompt_id on interrupt?). Research.
- [ ] MPI-929 Cancel mascot silent for cloud jobs. Research; reproduce first.
- [ ] MPI-928 Cloud Stop bills and drops the output. NEEDS FABIO'S DECISION: let the paid
      result land as a card (like the local R09 path) and say it was charged, or replace Stop
      after submit with an "already paid" note. Ask him early so it is not the last blocker.
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
