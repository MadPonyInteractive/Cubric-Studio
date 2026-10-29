# MPI-1336 checklist

- [x] Card created as an MPI-1134 member, research notes written (video + Video Edit needs)
- [x] Read the existing research (MPI-1134 research, windowing.md, MpiH3MaskedPrefix)
- [x] Bench plan written (plan.md): MaskedPrefix latent path vs pixel path; Motion Context V2
      workflow not needed, we own the method
- [x] Fabio's go on the bench (local GPU, ~1-2 h, no money)
- [x] Bench 1: Video Edit case, arm A vs B (A wins, B drifts)
- [x] Bench 2: Infinite Video case, Singularity v2, arm A (joins clean, backdrop -3.5 %/window)
- [x] 6-window chain: drift compounds (-27 % backdrop, noise by window 6); joins stay clean
- [ ] Re-anchor bench: grade-match to window 1, and bridging
- [ ] 22-frame context row, resume after cancel (2K per window is Video Edit's question only)
- [ ] Fabio picks the method
- [ ] Build the window primitive; Video Edit and the Infinite Video Flow both use it
