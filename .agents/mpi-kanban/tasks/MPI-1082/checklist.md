# MPI-1082 checklist

- [ ] Prove the cause: the shell window is still hidden when `shellWindow()` returns, so the rAF that sets `data-active` does not run inside the fixed sleeps
- [ ] Replace the sleeps with waits on the real conditions (Next landed on the step; the active slide holds `.mpi-base-flow__work`)
- [ ] Spec still proves its point: fails with `align-items: center`, passes with `safe center`
- [ ] Spec green locally, repeated runs
- [ ] CI green on the commit
