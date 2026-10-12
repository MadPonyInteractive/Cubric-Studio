# MPI-1104 brief

See task.json description and umbrella plan `tasks/MPI-1102/plan.md`.

## Noticed

- `MpiInstalledDisplay._applyIndeterminate` does `qs('.mpi-progress', _progressBarInst.el)`, but a mounted MpiProgressBar's `el` IS the `.mpi-progress` root and `qs` searches descendants only, so the "Preparing…/Verifying…" sweep (MPI-95) likely never shows. Toggle `_progressBarInst.el.classList` directly. Not verified live.
