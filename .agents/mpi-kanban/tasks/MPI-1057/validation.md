# MPI-1057 validation

Verify mode: user-ux (plan.md). Automated evidence below; Fabio's look on his next connect closes it.

## Automated (2026-10-10, session 8f2f562a)

- `node --test tests/pod-stall-cap.test.cjs` - 4/4 pass: cap is 8 min; a boot not ready at
  8 min - 1 ms is untouched, at 8 min its Pod is deleted and status reports `stalled.podId`;
  Cancel first disarms the cap; a new boot clears the old report; `getPod({timeoutMs})` aborts
  a request that never answers.
- `node --test tests/models-check-pending.test.cjs` - 1/1 pass: a `pending` check emits no
  `models:checked` and leaves `MODELS[].installed` alone.
- 37 suites touching the edited modules (`--test-concurrency=1`): 311/311 pass.
- `npx eslint` on all touched files: clean.
- The Pod-field log line renders in the test log:
  `Pod pod1 status=RUNNING startedAt=- cudaVersion=- dc=- machineAssigned=false ...`

- 2026-10-10 later: toast removal + Flow hot-store fix: tests/pod-identity-hot-store.test.cjs 10/10 (new Flow case fails without the fix: no files staged); 35 suites importing commandExecutor 352/352; eslint clean.
- Live: PRO 4000 and PRO 6000 connects logged `[remote] phase` + Pod-field lines as designed.

## Sliced upload, > 2 GiB (2026-10-10, session 01fc9cdf)

- `python test_upload_chunk.py` (mpi-ci wrapper): pass - slices land in order, only the last
  renames `.part` to the file, a retried slice rewrites its own bytes, a gap answers 409 with
  what the Pod has, offset 0 starts over, input kind lands in INPUT_DIR, traversal/bad kind/
  past-total 422, no token 401. `test_models_upload.py` still passes.
- `node --test tests/remote-upload-chunked.test.cjs`: 1/1 - the REAL `remoteUploadModel`
  sends a 64 MiB + 5 B file as 3 slices (none over 32 MiB, all authed), a 502 on slice 2 is
  resent at its own offset, sha256 identical on arrival; `remoteUploadInput` uses the same path.
  With the old code the route does not exist, so it fails.
- One-off, real uploader -> real wrapper (uvicorn on localhost, ComfyUI-less): a
  2,154,823,683-byte file. `fs.readFile` on it throws Fabio's exact error ("File size
  (2154823683) is greater than 2 GiB"); the new path lands it in 65 slices, all 200, 4.9 s,
  Node RSS 137 MB, sha256 match, size match.
- Related suites (lora-missing-remote-toast, remote-uninstall-reporting, pod-identity-hot-store,
  remote-target-path-deps, remote-engine-assets + the new one): 20/20. eslint clean.
- Runtime: `./publish-runtime.sh dev` -> dev manifest `wrapper_version 0.2.46`,
  `wrapper_sha256 2ce79cab...` = working tree. Stable untouched (0.2.45).

## Not provable here

- The LOCAL · OFFLINE cause (status route outliving the feed's 4 s abort while RunPod's
  getPod hung) is the strongest fit, not proven. The `[remote] phase` log names the cause of
  the next one either way.
- A real stall cannot be staged on demand; the 8-min path is proven by the test only.
- RunPod's proxy per-request body cap and the 524 timer on an upload are not documented; the
  32 MiB slice is chosen to sit under both. Only a real Pod upload proves it.

## Fabio's look (pending)
