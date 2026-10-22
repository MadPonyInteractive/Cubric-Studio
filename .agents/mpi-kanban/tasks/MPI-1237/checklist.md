# MPI-1237 checklist

- [ ] `generation.quote` answers `tiles` (the status bar's own count) for a Use Tiles run, local or cloud
- [ ] Cosmo's `generate` started reply carries the count; unknown count -> "the status bar shows it"
- [ ] The running-now line of every later turn carries the count
- [ ] Unit test: tiled generate -> started message + in-flight line name N tiles
- [ ] `docs/agent/upscaling.md` line updated
- [ ] lint + npm test green, pushed, CI green
