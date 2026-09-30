# MPI-989 validation

## Gap

MPI-979/981 (2026-09-29): no doc and no docs/README.md row covered the cloud generation path, so
the dialog's error copy was found by grepping the code. Fabio said yes at close-out.

## Done (f10b2ad80)

- `docs/cloud-generation.md` (98 lines): the path (generationService -> runCloudCommand ->
  POST /deepinfra/generate -> the native inference route), what the route builds (size, batch vs
  fan-out, reference placement per ModelDef `cloud` field), money (price tag, credit gate, Stop
  after the POST), failures and the dialog copy after MPI-981, the agent paths, the tests.
- `docs/README.md` row, beside Dictation.
- `js/services/cloudExecutor.js`: a comment MPI-981 made stale ("the dialog shows fixed copy per
  code") now says a PROVIDER_ERROR with a reason is the exception. Comment only.

## Evidence

Every symbol, route, constant and MPI number in the doc was read in `cloudExecutor.js` and
`routes/deepinfra.js` this session; one unverified count ("15 cloud models" vs the code's
"sixteen") was cut rather than guessed. tests/cloud-executor.test.cjs 36 pass after the comment
edit; eslint clean.
