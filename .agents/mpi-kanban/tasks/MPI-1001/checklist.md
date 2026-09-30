# MPI-1001 checklist

- [x] connect() re-opens an OPEN socket that is not ready; ensureWsConnected replaces a socket that can never turn ready (OPEN + flag down, or a handshake stuck past 10 s); a timeout logs the socket state
- [x] unit test on the wedge (fails on the old code, passes on the fix)
- [ ] Fabio: a Pod run after a model install (ComfyUI restart) lands a card; app.log `Preview WS` lines read
- [ ] the tester's log read (a second cause?)
