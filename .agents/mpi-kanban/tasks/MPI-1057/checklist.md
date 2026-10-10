# MPI-1057 checklist

- [x] Stall cap: a Pod not ready at 8 min is deleted, with a plain message
- [x] Bounded getPod (3 s) + Pod-field change log (v2 fields)
- [x] Phase-change log with cause; feed keeps 'connecting' when status gets no answer
- [x] Cancel holds "cancelling…" + live wait until RunPod's DELETE answers
- [x] 0 / N: a pending models check leaves the count alone
- [x] Tests + docs/runpod-remote-engine.md
- [x] No toast between Connect and its outcome (Fabio)
- [x] A Flow run stages its models on the Pod disk (was: none)
- [ ] Volume listing on the next connect (13 GB unexplained)
- [ ] Fabio's look on his next connect (user-ux)
- [ ] Release note in docs/releases/UNRELEASED.md (claimed by MPI-1036's session at close-out time? check)
