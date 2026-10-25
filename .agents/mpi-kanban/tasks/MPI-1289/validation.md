# MPI-1289 validation

Cause: `.mpi-group-card--show-info:hover .mpi-group-card__overlay` (0,3,0) hid the overlay and
outranked `.mpi-group-card--renaming .mpi-group-card__overlay` (0,2,0), so the rename field
vanished under the cursor. Fix: the hover-hide rule now skips `--renaming`.

Check (headless Chromium, real stylesheet, cursor over each card in show-info mode):
overlay opacity `0` for a normal card (hover-to-hide intact), `1` for a renaming card.
