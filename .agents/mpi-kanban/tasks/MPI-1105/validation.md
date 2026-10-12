# MPI-1105 validation

Closed without code. Fabio, 2026-10-12: "you don't need to create a flash. You already have it ... something that
just passes by". That is the existing moving sweep (status bar `sb-indeterminate`, MPI-147; `MpiProgressBar`
`mpi-progress--loading`, MPI-95). A job in the queue shows it on its own row (MPI-1104 for non-GPU jobs), so no
separate right-edge animation is built.
