# MPI-1296 checklist

- [x] Bridge forwards per-lane progress (tool:progress / tool:indeterminate) to the float window, seeded on open
- [x] main.js + floatLatentWindow.cjs relay `float-latent:progress`
- [x] float-latent.html fills the tile footer; sweep when no real %; cleared on Done / next item
- [x] Lint + tests green (3684 pass, 0 fail)
- [ ] Seen in an isolated app with the window minimised during a run
