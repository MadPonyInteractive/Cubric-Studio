# MPI-1330 validation

- `node --test tests/engine-dropped-not-oom.test.cjs tests/comfy-ws-drop-local.test.cjs`: 8/8 pass. The new test pins
  `err.remote` on the dropped-engine error, the `!err.remote` guard around commandExecutor's toast, and the
  shell listener's toast.
- `npx eslint` on the three changed sources: clean.
- `npm test`: 3800 tests, 3798 pass, 0 fail.
- Not live-checked: forcing a real Pod OOM needs a rented GPU. The user's own screenshot (2026-10-29, two toasts
  for one drop on a 57 GB Pod) is the reproduction. The toast paths are covered by the source checks above.
