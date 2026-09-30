# MPI-1001 checklist

- [x] connect() re-opens an OPEN socket that is not ready; ensureWsConnected replaces a socket that can never turn ready (OPEN + flag down, or a handshake stuck past 10 s); a timeout logs the socket state
- [x] unit test on the wedge (fails on the old code, passes on the fix)
- [x] Fabio: a Pod run lands clean (2026-09-30). The restart trigger could not be fired: no model install brings a node any more; Fabio closed on the unit test ("you can close it")
- [x] the tester's log: waived by Fabio's close; if his drops continue, his `<install>\user-data\logs\app.log` gets a new card
