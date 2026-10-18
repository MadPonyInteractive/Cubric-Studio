# MPI-1102 - No silent work: every job shows in the queue (umbrella)

Fabio, 2026-10-12. Rule: `.claude/rules/dos_and_donts.md` section "Every action shows itself" (MPI-1100).
Placement: GPU work = generation queue + status bar. Non-GPU work (downloads, uploads, CPU, ffmpeg,
file copy) = a row in the queue panel's Transfers list, the same row downloads use. No real progress
number = the moving sweep that already exists. **Nothing new gets built** (Fabio, 2026-10-12): reuse
the Transfers row, `MpiProgressBar` and its `mpi-progress--loading` sweep.

## Members

| Card | What | Phase |
|---|---|---|
| MPI-1103 | Rule amendment: sweep for no-progress jobs, GPU vs non-GPU placement | 0 |
| MPI-1104 | Transfers rows take CPU jobs too, existing sweep when no % | 1 |
| MPI-1105 | Right-edge flash - DROPPED, the existing sweep is the signal | - |
| MPI-1106 | GIF + sheet jobs in the queue (agent GIF verbs, GPU cutout, gallery Make GIF) | 2 |
| MPI-1107 | Bulk Download of 2+ cards: async copy + queue row | 2 |
| MPI-1108 | Model file drop: copy progress in Transfers | 2 |
| MPI-1109 | Describe on the online LLM backend (gallery + Cosmo): queue row with sweep | 2 |
| MPI-1110 | Project Cleanup assets: queue row with sweep | 2 |
| MPI-569 | Enhance on an exempt op with an empty prompt shows the wrong toast (from MPI-896) | any |
| MPI-543 | Notification history: a button showing the last five toasts (from MPI-896) | any |
| MPI-302 | Generation ETA in the StatusBar, both engines (from MPI-896) | any |

**Merged 2026-10-18 (Fabio, board tidy):** MPI-896 (Feedback surface) folded in here, same
subject: what the app says back. Its three open members joined; its plan stays in
`tasks/MPI-896/plan.md` as their background. They touch different files from phase 2, so any
of them can run beside it.

## Phases

- **0** - rule text first, so every later member is built against it.
- **1** - MPI-1104: let the existing Transfers list carry a CPU job. Small: one more row kind.
- **2** - the silent actions found by the MPI-1100 survey. Each depends on MPI-1104 except the GPU half
  of MPI-1106 (GIF cutout through `enqueueGeneration`), which can go first.

The umbrella closes when its last member does.
