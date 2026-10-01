# MPI-1008 Checklist

- [x] Repro fails before the fix (device mismatch)
- [x] `load_patchers` forces a full load; repro passes
- [x] Fork committed + pushed (`529c4be`)
- [x] `node_lock.json` repinned to the pushed commit
- [ ] Live DramaBox run on the fixed node (Fabio's MPI-1004 look)
- [ ] CI green on the repin commit
