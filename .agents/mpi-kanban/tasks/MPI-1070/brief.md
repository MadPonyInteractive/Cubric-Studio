# MPI-1070 brief

## Noticed

- When a generation is dispatched with no prompt box mounted (an MCP/connector `generate`
  while the user is on the landing page) and a No GPU Pod is connected, `_laneOf` in
  `js/services/generationService.js` still returns 'remote'. commandExecutor resolves
  'local' for the same job (`isDownloadOnly()`), and the two lanes disagreeing is the
  MPI-213 phantom "1 RUNNING". This was already true before MPI-1070 (the old gate only
  covered navigation). The fix is one line in `_laneOf` mirroring commandExecutor:1756.
  The file is under a peer claim (MPI-1057), so it was left alone.
- `tests/desktop/landing-grid-release.spec.js` is red on HEAD too: `ENOENT ...
  project\project.json`.
