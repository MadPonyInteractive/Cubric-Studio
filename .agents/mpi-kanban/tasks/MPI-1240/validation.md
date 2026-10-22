# MPI-1240 validation

2026-10-22:
- Cause: transcript of session "Child-safety gate" (c30ee2a0): `npm test` 00:42:55Z, pre-push
  `npm test` 00:45Z; M:\ root mtime 01:45 local (00:45Z). Lexar NM790 Healthy, no disk/NTFS
  errors in System log. Live app log stopped 2026-10-21 19:55 local (app not running).
- Old helper reproduced: child process with CUBRIC_MODELS_ROOT/ENGINE_ROOT on a non-temp canary
  -> canary deleted (`canary survived = false`).
- Fixed helper: `node --test tests/sandbox-roots-hygiene.test.cjs` -> pass 2, fail 0.
- `npx eslint tests/helpers/sandbox-roots.cjs tests/sandbox-roots-hygiene.test.cjs` -> 0.
- Pending: CI on the fix commit.
