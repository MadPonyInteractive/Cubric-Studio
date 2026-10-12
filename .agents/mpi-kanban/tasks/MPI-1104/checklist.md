# MPI-1104 checklist

- [x] `state.cpuJobs` key (replaced whole, never mutated)
- [x] `js/services/cpuJobs.js`: `runCpuJob(label, fn)` adds a row, runs `fn(setProgress)`, row leaves on any end
- [x] MpiQueuePanel Transfers: `cpu` row kind, same MpiProgressBar, `mpi-progress--loading` when there is no %
- [x] Test: helper adds / patches / removes the row on success and on failure (`tests/cpu-jobs.test.cjs`)
- [x] Live: `tests/desktop/cpu-job-row.spec.js`
