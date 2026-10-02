# MPI-1012 brief

## Noticed

- `scripts/smoke-workflows.mjs` writes its error path to the TRACKED `dev_configs/smoke-run.txt`
  (`RUN_LOG`), so a unit test that trips it (here `tests/smoke-flows.test.cjs` asking for a
  flow id that no longer exists) overwrites 364 lines of real smoke evidence with one error
  line. Restored from HEAD this session. The test could set `CUBRIC_SMOKE_RUN_LOG` to a temp
  file.
- `MpiFlowLibrary.js:468`, `MpiModelManager.js:1658`, `routes/downloadManager.js:419` and
  `routes/projects.js:2329` still name `chatter-box` / `flowChatterBox` in comments as
  historical examples. Harmless; touch them with the next edit there.
- `release-health-check.mjs` § checkSmokeEvidence prints the evidence file's own frozen
  scope ("covers all 36 models") with no look at today's registry, so it reads full coverage
  while stable-audio-3 and chatterbox have no rows. Reported, never gated; MPI-595 item 2's
  merge rewrites the scope (and since P6 keeps a new model unproven). Computing `unproven`
  from the live MODELS there would make the line true at any time.
