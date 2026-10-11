# MPI-1076 checklist

- [x] (1) Connect announced once, by the connect flow, never inferred from a feed edge; the feed holds a connected Pod through an upload
- [x] (2) Loading-new-nodes on Cue: fixed in MPI-1057 (comfy:restarted), nothing here
- [x] (3) Missing-files toast length: fixed in MPI-1057, nothing here
- [x] (4) Uninstall says "uninstalled" only when something went (the Library half is MPI-1078)
- [x] (5) Generate-time upload: no start toast, no "is on the Pod" toast (Transfers + the generation say it)
- [x] (6) StatusBar.notify / ui:* relays use the MPI-542 reading time, not a flat 6 s
- [x] docs/toasts.md updated
- [x] tests pass (3095/3095 + 5 new checks)
- [ ] Walk the remaining ~230 toast sites one by one (true / on time / not said elsewhere): only if Fabio wants it beyond the five he saw
