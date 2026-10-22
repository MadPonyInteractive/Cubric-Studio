# MPI-1237 checklist

- [x] `generation.quote` answers `tiles` (the status bar's own count) for a Use Tiles run, local or cloud
- [x] Cosmo's `generate` started reply carries the count; unknown count -> "the status bar shows it"
- [x] The running-now line of every later turn carries the count
- [x] Unit test: tiled generate -> started message + in-flight line name N tiles
- [x] `docs/agent/upscaling.md` line updated
- [x] lint + npm test green, pushed, CI green (run 39706763989)
