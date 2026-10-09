# MPI-1051 checklist

- [x] commandExecutor: `prefetchInstalledModels` takes an optional id list (default = every installed model, the connect path)
- [x] downloadService: a model-level install complete (not silent) calls it with the just-installed model, after the re-sync
- [x] Guards unchanged: toggle OFF, local engine, CPU download-mode Pod = no staging
- [x] Test proves install-complete stages only that model and respects the guards
- [x] Release-note bullet in docs/releases/UNRELEASED.md
- [ ] Doc line in docs/runpod-remote-engine.md § Prefetch — peer MPI-1050 holds it; sent as message cc67cfc4
