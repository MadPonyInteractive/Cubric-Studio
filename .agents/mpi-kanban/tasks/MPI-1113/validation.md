# MPI-1113 validation

2026-10-12 - auto checks PASSED.

- `node --test tests/download-silent-job.test.cjs` - 4/4 pass. Runs the REAL
  `_startRemoteDownload` on an all-on-volume heal with a fake SSE client on the real
  stream route: POST body `job.silent === true`, model-level `download:complete` carries
  `silent: true` and is broadcast AFTER `res.json` (the MPI-395 ordering the race rides on),
  store `snapshot()` carries `silent` (survives a renderer reload); a user install is not
  silent; a live job re-registered loud is announced; `_firePost` adopts only while
  `cur.status === 'downloading'` and `_silentJobs` is gone.
- Download/install/remote/snapshot suite (52 files): 219/219 pass, `--test-concurrency=1`.
- `npx eslint` on the four changed source/test files: clean.

Not run: the live repro (connect a Pod, reload mid-heal, delete the Pod) - it needs a paid
Pod. The mechanism is pinned by the test above; Fabio's next Pod session is the field check.
Suspect 2 (a remote job outliving its Pod) does not apply to this incident: an all-on-volume
install settles inside the request handler.
