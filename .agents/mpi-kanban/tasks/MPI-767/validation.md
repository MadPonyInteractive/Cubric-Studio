# MPI-767 validation

Wording-only change; no behaviour touched (same handlers, same endpoints).

- Rename script asserted each of the 15 target strings occurred exactly once before writing.
- `git diff -U0` on the 4 files: 15 lines out, 15 in, every one a Terminate -> Stop wording swap.
- `grep -n "Terminate|terminat"` over the 4 files: only RunPod-side uses remain
  (Pod-DEATH note in runpod-remote-engine.md, the EXITED/TERMINATED status toast row).
- `npx eslint js/components/Organisms/MpiRunpodSettings/MpiRunpodSettings.js`: exit 0.
- No test or lint rule pins these strings (grep of tests/, scripts/, .eslint-rules/).
- Any-region hint now says models are deleted when you stop or delete the Pod; Stop wipes the
  container disk per docs/builder/03-spin-and-install.md (Restart vs Stop vs Terminate table).
- Live check (Fabio, 2026-09-15, own app after reload): popup reads Stop Pod / Delete Pod / Cancel
  with the new copy. Verified.
