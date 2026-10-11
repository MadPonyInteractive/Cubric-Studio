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

## U1 backend (2026-10-10, session 11c1e888)

- `node --test tests/remote-uploads.test.cjs` 6/6: lists, sequential queue + per-slice progress,
  skip already-on-Pod / not-found, free-space gate, cancel (running + queued, `.part` deleted),
  delete refusing an app-installed weight, 1 GB GPU refusal (CPU Pod passes).
- Regression: remote-upload-chunked, pod-self-heal-dead, cloud-installed-survives-sync,
  pod-cpu-flavors + the new file: 23/23. eslint clean on every touched file.
- mpi-ci `python test_models_list.py` ok, `python test_upload_chunk.py` ok.
- Not proven: a real Pod (0.2.47 is not published; U4).

## U2 Transfers (2026-10-10)

- Isolated app: rows render, progress patches, hides when empty; stream sends upload:snapshot on connect. 68 related tests green.
- Fabio, live app: SDXL Realistic download row, % + speed climbing, under a running job and above the foot. Layout: "It is fine." Cancel check pending.
- Fabio, live: download finished and left Transfers; Cancel on a second install removed the row at once. U2 accepted. (He saw no installed toast: notificationService sends an OS notification instead when the window is unfocused; not this change.)

## U3 Upload models overlay (2026-10-10, session 6d3f1208)

- eslint clean on every touched file; `node --test tests/path-tree.test.cjs tests/remote-uploads.test.cjs` 7/7.
- Isolated app (headless playwright-cli, stubbed Pod list): queue -> row on the Pod side at once,
  `upload:progress` -> %, job complete -> list re-read; Delete cancels a live upload
  (`/remote/uploads/:id/cancel`) and deletes a stray `.part`; app-installed row unselectable;
  tab switch; real route with no Pod -> "Connect a Pod first..." (list, Upload, Delete); a
  `ui:warning` with the Upload models action opens the overlay on the Upscale tab; the button
  sits in Remote > Storage, disabled with no Pod.
- Not proven: a real Pod (0.2.47 unpublished, U4), and the `too_big_for_gpu` branch through a
  real generation (lint only; its toast + button were driven directly).
- Fabio's look (screenshots): "everything else is fine"; the middle Upload button moved under
  the local box like Delete, disabled until a selection (headless check: disabled -> enabled on
  select). Lint clean.
- Runtime 0.2.47 published to dev (Fabio's OK), from mpi-ci HEAD 80a02c4, clean tree: live
  manifest `wrapper_version 0.2.47`, wrapper sha 3dc462d7... == the committed file; start.sh /
  start-cpu.sh shas unchanged from 0.2.46. MPI-1044 messaged (promote now carries 0.2.47).

## U4 + live proofs (2026-10-10/11, Fabio's app, log watched read-only)

- Upload models, CPU Pod, runtime 0.2.47 dev: sulphur_lora_rank_768.safetensors 10.27 GB,
  22:52:26Z -> 23:30:00Z (37.5 min, ~4.6 MB/s, even 10% steps), no failed slice; overlay shows
  it on the Pod at 10.36 GB. Fabio missed the 6 s completion toast (window unfocused): fixed,
  `upload:finished` now goes through notificationService (OS notification when unfocused);
  tests/upload-finished-notify.test.cjs + notification-stale-count 5/5.
- **8-min stall cap PROVEN LIVE**: RTX PRO 4500 Pod maduch90z92qjf created 23:54:13Z, RunPod
  never started it (console: no logs). Cap fired 00:02:13.431Z (8 min 0 s), delete -> 204 at
  00:02:14Z, phase -> none 00:02:16Z. Phase label still reads "connect ended without a
  connection" (the known label item).
- Still open: a GPU-Pod generation with the uploaded LoRA (no re-upload), then promote.

## Stall copy (2026-10-11, session 7ea70332)

- Panel hint now names the data center + Any region (no volume). eslint clean. Fabio accepted the wording ("fine until we implement global volumes"). js/shell.js twins (~1091, ~1217) still owed.
- js/shell.js pass: "Settings -> RunPod" copy now "Remote" (none left: grep), never-started dialogs carry the data-center text, `remote:stalled` OS notification when unfocused. node --test remote-stalled-notify + upload-finished-notify + notification-stale-count + pod-stall-cap: 10/10. eslint clean.
