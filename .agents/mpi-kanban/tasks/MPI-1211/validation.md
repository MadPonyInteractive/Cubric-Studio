# MPI-1211 validation

- `npm test` in `mpi-ci/cubric-bench`: 47 pass, 0 fail; new test covers owner skip (201 at count 99, no rate row),
  wrong key (429), no secret (429). Without the code the owner case is a 429, so the test bites.
- Secret `OWNER_KEY` uploaded (64-hex key in `C:/Users/Fabio/.secrets/bench-owner.txt`), `wrangler deploy` ->
  version 5814ffeb-ac32-4d0b-87a0-0956f9e07aee on bench.cubric.studio.
- Live, past today's limit (the same sender got `RATE_LIMIT` an hour earlier): DeepSeek-V4.1-Flash-1017 runs 2 and 3
  POSTed with the key -> 201 `{"ok":true}` both; `GET /` shows it "counted 48/55 3 runs".
- Commit mpi-ci bc833b1, pushed to origin/main.
