# MPI-1102 - No silent work: every job shows in the queue (umbrella)

Fabio, 2026-10-12. Rule: `.claude/rules/dos_and_donts.md` section "Every action shows itself" (MPI-1100).
Placement: GPU work = generation queue + status bar. Non-GPU work (downloads, uploads, CPU, ffmpeg,
file copy) = a queue panel row with a progress bar. No real progress number = the moving sweep.
A new job entering the queue = a gradient flash on the right edge of the UI.

## Members

| Card | What | Phase |
|---|---|---|
| MPI-1103 | Rule amendment: sweep for no-progress jobs, GPU vs non-GPU placement | 0 |
| MPI-1104 | Queue panel: generic row for non-GPU jobs, progress bar + sweep | 1 |
| MPI-1105 | Right-edge gradient flash when a job enters the queue (eye test) | 1 |
| MPI-1106 | GIF + sheet jobs in the queue (agent GIF verbs, GPU cutout, gallery Make GIF) | 2 |
| MPI-1107 | Bulk Download of 2+ cards: async copy + queue row | 2 |
| MPI-1108 | Model file drop: copy progress in Transfers | 2 |
| MPI-1109 | Describe on the online LLM backend (gallery + Cosmo): queue row with sweep | 2 |
| MPI-1110 | Project Cleanup assets: queue row with sweep | 2 |

## Phases

- **0** - rule text first, so every later member is built against it.
- **1** - the shared pieces: the generic non-GPU queue row (MPI-1104) and the new-job flash (MPI-1105).
  MPI-1105 should hook the one place a job enters the queue (generation queue AND the generic row), not each caller.
- **2** - the silent actions found by the MPI-1100 survey. Each depends on MPI-1104 except the GPU half
  of MPI-1106 (GIF cutout through `enqueueGeneration`), which can go first.

The umbrella closes when its last member does.
