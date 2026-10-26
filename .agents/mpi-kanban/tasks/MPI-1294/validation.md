# MPI-1294 validation

- **Agent probe (isolated Electron app, character-sheet Flow, Enhance pending):** the clip's
  transform was sampled every frame. It rose from translateY(100%) to 0 in about 0.4 s once
  the clip played, held for the clip, then dropped back to 100% in about 0.4 s after `ended`.
  The next clip's src was set only once the last one was fully below the edge. When the job
  ended mid-clip, the clip slid out instead of vanishing. The wrapper's opacity stayed 1
  throughout.
- **Fabio's eye-test (2026-10-26):** "they slide in and out properly."
- Fix commit: 6993ab6d1.
