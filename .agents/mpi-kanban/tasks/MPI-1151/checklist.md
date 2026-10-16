# MPI-1151 checklist

- [x] Copy the test clip + picture out of `mpi_staged` into the card's research folder
- [x] Fabio's go on the bench order (size lever dropped by Fabio: prompt first)
- [x] Baseline M0 reproduces the app failure on the bench
- [x] Lever 2: `[reference generation]` framing for op 4 (M2) - FAIL
- [x] Prompt: place as `attribute_transfer` (M4) - PASS, Fabio
- [x] Picture-neutral check: M5/V4f FAIL, V4g (M4 on a bedroom) grows mountains, M6/V4h ({look} nouns) PASS both
- [x] Ship M6 in `flow_graph.py` -> raw + API node 74 -> proven equal to a fresh conversion; doc `video-edit.md`
- [x] Fabio's eye on M6 (monkey + bedroom side-by-sides): passes
- [x] Lever 3 (inverse mask): not run - not needed, Fabio said stop before it
