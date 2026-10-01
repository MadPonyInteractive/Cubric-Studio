# MPI-1008 Checklist

- [x] Repro fails before the fix (device mismatch)
- [x] `load_patchers` forces a full load; repro passes
- [x] Fork committed + pushed (`529c4be`)
- [x] `node_lock.json` repinned to the pushed commit
- [x] Live DramaBox run on the fixed node (Fabio's MPI-1004 look, step 1)
- [x] CI green on the repin commit (run 36836574990)
- Moved to MPI-595 B1: mpi-ci lock sync + DEV Pod image + smoke before the 2.0 cut
