# MPI-975 Checklist

- [x] Reproduce: a derivative of an in-flight save (thumbs on disk, sidecar not yet) is swept by another item's save-generation (`tests/save-generation-gc.test.cjs`, failed before the fix)
- [x] Fix: save-generation's GC no longer sweeps a derivative for lacking a sidecar (`routes/projects.js`)
- [x] Doc: `docs/project-integrity.md` § Orphaned sidecars
- [x] Heal: the one broken thumb on disk (Deepinfra model tests, removeBackground_004) re-made
- [x] Full unit suite green
