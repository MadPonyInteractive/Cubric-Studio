# MPI-1242 validation

- Isolated instance (`npm run app:isolated`, own port), `mpi_dev_force_update=2.1.3`: the bell's Dev updates panel shows **Update to v2.1.3** at the top, above "Mark all read" and the posts.
- Clicking it reaches `runUpdate`: the browser build answers "Update unavailable" (no IPC), the expected path outside the portable build.
- No update due: the slot stays hidden (`getPendingUpdate()` resolves null).
- `npm run lint` clean. `tests/extra-model-folders.test.cjs` now clears `CUBRIC_MODELS_ROOT`, which a dev shell exports and which leaked the real models drive into its list-files assertion; 5/5 pass.
