# MPI-1097 checklist

- [x] Root cause from app.log 2026-10-11 19:20Z: the previous Pod (y6q9xd4jaaoshr) was still
      running at boot, so the feed reported it connected (phase already none, no log) and the
      connect edge fired. The boot create then swapped to a new Pod (z43oc27o2ipwsv) with no
      disconnect edge, so `_wasRemoteConnected` stayed true and the new Pod's ready never fired
      the edge: no re-sync, no drift heal, models read not installed.
- [x] Server half already fixed by MPI-1071 (04f1ff901): drifted universal nodes install with force.
- [x] Fix (35596affc): a new `connecting` phase resets the connect-edge latch (`js/shell.js`).
- [x] Test: structural check in `tests/remote-engine-assets.test.cjs`, red without the fix (mutant), 9/9 with it.
- [x] npm test 3310 pass / 0 fail. [ ] CI green on 35596affc.
- [ ] Live proof rides the 2.1 Pod session (boot with remote on + a stray Pod, or a node_lock bump).

## Scope (corrected 2026-10-14)

Not every user, as first written on MPI-1044: it needs the PREVIOUS Pod still running when the app
starts AND a fresh create (Fabio's 10-11 boot had a stray Pod). A warm resume of the same running Pod
heals fine (its wrapper is up), and a stopped Pod only reads connected once ready. MPI-1071 already
made the server-side heal force a drifted re-clone.
