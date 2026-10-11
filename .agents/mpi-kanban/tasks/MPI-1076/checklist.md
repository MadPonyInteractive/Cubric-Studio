# MPI-1076 checklist

- [x] (1) Connect announced once, by the connect flow, never inferred from a feed edge; the feed holds a connected Pod through an upload
- [x] (2) Loading-new-nodes on Cue: fixed in MPI-1057 (comfy:restarted), nothing here
- [x] (3) Missing-files toast length: fixed in MPI-1057, nothing here
- [x] (4) Uninstall says "uninstalled" only when something went (the Library half is MPI-1078)
- [x] (5) Generate-time upload: no start toast, no "is on the Pod" toast (Transfers + the generation say it)
- [x] (6) StatusBar.notify / ui:* relays use the MPI-542 reading time, not a flat 6 s
- [x] (7) Queue-finished toast fires once per drained queue, after the last item has saved
- [x] docs/toasts.md updated
- [x] tests pass (3097/3097); CI green on 592c61562 and 7c4690aff
- [x] Full walk of the remaining ~230 toast sites: skipped, Fabio 2026-10-11 (fix them as he spots them)
