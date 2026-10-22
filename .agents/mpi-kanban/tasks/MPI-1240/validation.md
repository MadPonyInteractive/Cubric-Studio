# MPI-1240 validation

2026-10-22:
- Cause: transcript of session "Child-safety gate" (c30ee2a0): `npm test` 00:42:55Z, pre-push
  `npm test` 00:45Z; M:\ root mtime 01:45 local (00:45Z). Lexar NM790 Healthy, no disk/NTFS
  errors in System log. Live app log stopped 2026-10-21 19:55 local (app not running).
- Old helper reproduced: child process with CUBRIC_MODELS_ROOT/ENGINE_ROOT on a non-temp canary
  -> canary deleted (`canary survived = false`).
- Fixed helper: `node --test tests/sandbox-roots-hygiene.test.cjs` -> pass 2, fail 0.
- `npx eslint tests/helpers/sandbox-roots.cjs tests/sandbox-roots-hygiene.test.cjs` -> 0.
- Pushed 01:28Z by session "Moss image 1" together with 73cc5be36: CI run 39705903851 green.
- Full `npm test` with BOTH roots inherited from a non-temp canary
  (`C:/Users/Fabio/.mpi1240-canary/{models,engine}`): 3510 pass, 0 fail, 2 skipped; canary
  files intact afterwards. Real M:/CubricModels never used for this run.
- Other unit tests that touch the roots all pin a temp root before requiring the helper
  (disk-gate-names-model, install-start-settles, local-disk-gate-partial, remote-uploads,
  import-model-subfolder). Desktop specs (`tests/desktop/*.spec.js`) still inherit
  CUBRIC_MODELS_ROOT into the launched app: read-only, no delete path, not in `npm test`.
