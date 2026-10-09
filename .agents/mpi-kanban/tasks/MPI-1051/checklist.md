# MPI-1051 checklist

- [x] commandExecutor: `prefetchInstalledModels` takes an optional id list (default = every installed model, the connect path)
- [x] downloadService: a model-level install complete (not silent) calls it with the just-installed model, after the re-sync
- [x] Guards unchanged: toggle OFF, local engine, CPU download-mode Pod = no staging
- [x] Test proves install-complete stages only that model and respects the guards
- [x] Release-note bullet in docs/releases/UNRELEASED.md
- [x] Doc line in docs/runpod-remote-engine.md § Prefetch (8d78d223a, after MPI-1050 released the file)
- [x] Live test passed (Fabio, 2026-10-09: SDXL Realistic install -> "queued 2/2 file(s) for 1 model(s)")
