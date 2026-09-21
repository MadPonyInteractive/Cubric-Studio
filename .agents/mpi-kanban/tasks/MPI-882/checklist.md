# MPI-882 - checklist

- [x] `resolveComfyPath` resolves a dep at its DECLARED relative path, never by basename
- [x] `tests/dep-path-agreement.test.cjs` covers the same-basename-different-subfolder case
- [x] A missing weight at dispatch re-syncs install state so the model leaves the picker
- [x] The toast for a missing MODEL DEP points at Models, not at Model Settings
- [x] `docs/download-manager.md` resolver section matches the code
- [x] The remote upload path resolves the dropdown value by its own path too
      (`_resolveLocalModelPath`, `routes/remotePodState.js`) — it was uploading whichever
      same-named weight the walk met first
