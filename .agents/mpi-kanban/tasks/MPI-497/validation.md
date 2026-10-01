# MPI-497 Validation

Fixed by MPI-513 (umbrella), commit `9c593af5f`. Full evidence: `tasks/MPI-513/validation.md`
§ "Phase 2 re-test" and § "R1 + R2 fixes".

## Root causes (neither was the two-writer bug MPI-513 Phase 1 removed)

1. **The toast.** `_checkModelJobsComplete` broadcast the model-level `download:complete` with no
   record of whether any dep transferred, and `notificationService` toasts every one. A re-verify
   of a full volume therefore announced every model on it.
2. **The 100% bar.** The terminal-job TTL belts (`pruneTerminal`, 120 s done / 30 s failed) live in
   the reconciler's IDLE pass, but its poll returned early whenever nothing was active, and SSE
   connect only reconciled while something was. A finished job was immortal, and the Model
   Library draws a lingering `complete` job as busy (MPI-241) on any tile whose model is not
   installed on the active engine - after a Pod install and a switch to local, the stranded bar.

## Fix

- Store marks `alreadyInstalled` when every dep is on disk at registration; `_broadcastModelComplete`
  carries it; the client folds it into `data.silent` (no toast, no cascade toast, re-sync still runs).
- The reconciler poll ticks while the store holds ANY job; SSE connect always runs the pass.

## Evidence

- Before (2026-10-01, isolated `:54072`, HEAD `8dc8c1d08`): re-install with the dep on disk sent a
  plain model-level `download:complete`; the `done` job was still in a fresh SSE snapshot at 129 s.
- After (isolated `:50063`): re-install sent `{"modelId":...,"alreadyInstalled":true}`; the `done`
  job left `/comfy/downloads/status` at 132 s with nothing else running.
- `node tests/install-store.test.cjs` 36/0, `node tests/install-reconciler.test.cjs` 17/0, each new
  test red with its fix swapped out; `npm test` 2631/0; CI run 36878091671 green (unit + desktop 1-4).
- Not run on a Pod: the remote leg rides on MPI-513's pending Pod test (Fabio's pick).
