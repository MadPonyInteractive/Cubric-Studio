# MPI-804 Checklist

- [x] Batch hydration route (one request per project open)
- [x] Reconciler consumes it; dead per-item helpers removed
- [x] Grid loads cancelled at click time; failed open reports itself
- [x] Test: batch result matches the per-item behaviour (meta, orphan, missing sidecar, failure)
- [ ] Fabio: restart the app and click a project while the engine boots
