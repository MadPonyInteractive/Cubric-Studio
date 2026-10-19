# MPI-489 Validation

Closed 2026-10-19 by the board umbrella pass, Fabio approved. No new code: fixed by MPI-1142
(`5f140b4f0`, 2026-10-16, "one shared event stream").

- The defect: nothing on the boot path called `downloadService._ensureSSE()`, so a client that
  did not click Install (a reload, a second window) never got the connect-time `download:snapshot`.
- Now: `js/shell.js:232` calls `downloadService._ensureSSE()` in the boot tick, with the comment
  "Downloads subscribe in this same tick so the server's connect snapshot (live jobs after a
  reload) cannot arrive unheard." Read 2026-10-19.
- Not re-run live here (needs a running multi-GB download); the code path the card named is gone.
