# MPI-1057 plan - RunPod connect feedback tells the truth

## Goal

During a RunPod connect the app says what is really happening: the home strip stays on
"connecting", the model count does not drop to 0, a Pod RunPod never starts is deleted at
8 minutes with a plain message, Cancel shows it is still waiting on RunPod, and the log
names whoever changes the connecting phase.

## Findings (2026-10-10, from code + `%APPDATA%/Cubric Studio/logs/app.log`)

1. **LOCAL · OFFLINE mid-connect.** The shell feed (`js/shell.js` `_initRemoteConnectionFeed`)
   aborts `/remote/comfy/status` at 4 s and treats the abort as `connecting:false`, so the
   MPI-110 "connect ended" branch emits `phase:null`. The status route can take longer than
   4 s: its `/health` probe waits up to 5 s, and on a non-200 it calls RunPod `getPod` with NO
   timeout (`_podRuntimeStatus` -> `client.getPod` -> `_rest`, plain fetch). RunPod's API hung
   on the stuck Pod (its DELETE took ~2 min), so every feed tick timed out and the strip stayed
   local. The Settings poll has no fetch timeout, so it waited and kept saying "connecting…".
   Strong, not proven: nothing logs the status route's duration. The phase log (item 3) will
   prove the next one.
2. **0 / 24.** While the Pod wrapper boots, `/comfy/models/check` answers
   `{results:{}, pending:true}` (MPI-211). `syncModelInstalled` (`js/data/modelRegistry.js`)
   ignores `pending`, builds an empty installed set and emits `models:checked` -> 0 / N.
3. **Cancel shows nothing.** `/remote/pod/delete-active` flips remote mode off and clears
   `_starting` BEFORE RunPod's DELETE answers. `_connectEngine`'s `finally` clears
   `_engineBusy` within ~4 s of Cancel, then the panel's 5 s status poll paints
   "stopped" + an enabled Connect while the DELETE is still pending.
4. **No stall cap.** Only EXITED/TERMINATED/ERROR and a maintenance flag end a connect; the
   5-min watchdog only hints. A Pod RunPod never starts bills until the user acts.

## Steps

1. **Stall cap, 8 min** (Fabio, 2026-10-10) - `routes/remotePodLifecycle.js`. `_setStarting`
   arms one timer when a boot starts and clears it whenever `_starting` goes false. If it fires,
   log a warn, flip remote mode off, delete the tracked Pod, and hold `_stalled = {podId,
   gpuTypeId}` for the status route to report (`stalled`), cleared by the next create/reconnect.
   Renderer: `_pollEngineReady` (Settings) and the shell feed both act on `stalled` - plain
   message ("RunPod's host never started your Pod, so we deleted it after 8 minutes. Nothing
   is wrong on your side - try another GPU."), saved podId + wasConnected cleared, phase null.
   The 5-min watchdog hint says the app stops it at 8.
2. **Bounded getPod + Pod-field log** - `routes/runpodRemote.js` `getPod` takes an optional
   timeout (AbortSignal); `_podRuntimeStatus` uses 3 s and keeps its last known status on a
   timeout. It logs `desiredStatus / lastStartedAt / lastStatusChange / machine id / publicIp /
   portMappings` once per change, so the next stall can be compared with a healthy boot.
3. **Phase log + feed fix** - `js/shell.js`: `_setRemotePhase(phase, by)` logs every change
   with its cause (`[remote] phase connecting -> none (by …)`); external emits carry `by`
   (Settings, comfyController). The feed keeps 'connecting' when the status request got NO
   answer; only a real answer of `connecting:false` ends it.
4. **Cancel feedback** - `MpiRunpodSettings.js`: a `_cancelling` flag holds "cancelling…", a
   disabled button and a live "waiting for RunPod to delete the Pod (Ns)" hint until the
   DELETE returns; `_applyEngineStatus` and `_connectEngine`'s `finally` leave it alone.
5. **0 / N** - `syncModelInstalled` returns early on `pending` (no emit), so the strip keeps
   its last real count until the Pod answers.
6. Tests + docs: stall cap and getPod timeout against the real route module; the pending sync;
   `docs/runpod-remote-engine.md` gets the 8-min cap.

## Upload models (Fabio, 2026-10-10)

His UX: connected to any Pod (CPU or GPU) -> "Upload models" button -> overlay: LEFT = local
tree, RIGHT = remote tree, Upload button between, Delete under the right box (deletes from the
volume, or cancels that file's upload if still going). LoRAs AND upscale models (the two user
buckets the upload path already takes). Uploaded files appear on the right at once; progress
shows in a new TRANSFERS section at the bottom of the Cue panel (key `q`), downloads AND
uploads, one bar each, gone when nothing transfers. Rows can carry a button.

- **U1 backend** (owner: main session). `routes/remoteUploads.js` (new): one sequential upload
  queue, jobs `{id, type, filename, totalBytes, sentBytes, status queued|uploading|complete|
  failed|cancelled, error}`; `_uploadInSlices` takes `onProgress` + `signal`; events
  `upload:snapshot` / `upload:progress` on the existing downloads SSE stream
  (`broadcastEngineEvent`). Routes: `GET /remote/user-models?type=` -> `{local:[{rel,
  sizeBytes}], remote:[{rel, sizeBytes, partial}]}`; `POST /remote/uploads {type, files}`
  (free-space gate via `remoteVolumeFreeBytes`, 1.05x); `POST /remote/uploads/:id/cancel`;
  `POST /remote/user-models/delete {type, filename}` (cancels a live upload of it first, then
  wrapper `/wrapper/models/delete`). Wrapper 0.2.47: `GET /wrapper/models/list?type=` (files +
  sizes + `.part` as partial; `/wrapper/ls` runs `du` and is slow). 1 GB guard in
  `/remote/upload/model` when `!noGpu` -> 409 `too_big_for_gpu`. Tests: node + python.
- **U2 Cue transfers** (frontend). `MpiTransferList` (new Compound) mounted as a 4th grid row in
  `MpiQueuePanel`; rows from `state.downloadJobs` (active) + `download:progress`, and uploads
  from `state.uploadJobs` (fed by `downloadService`, which owns the EventSource) +
  `upload:progress`; `MpiProgressBar` per row; row `action {text,onClick}`.
- **U3 Uploader overlay** (frontend). `MpiFileTree` (new Primitive: inline, multi-select,
  reuses `MpiTreePicker`'s `buildTree`); `MpiModelUploader` (new Compound on `MpiOverlay`,
  tabs LoRAs / Upscale models). Button in `MpiRunpodSettings` Storage subgroup when ready;
  the 1 GB toast's action opens it (`StatusBar.notify` action, `docs/toasts.md`).
- **U4 proof**: publish dev 0.2.47; Fabio, CPU Pod, his 10.27 GB LoRA via the overlay.

Kept as today: uploads land by BASENAME (`remoteUploadModel`), matching the generate-time
presence check. Noticed: a subfolder LoRA (`sub/x`) then sits at `loras/x` on the Pod.

## Verification

**Verify mode:** user-ux

- `node --test` on the new tests + `tests/pod-self-heal-dead.test.cjs`,
  `tests/cloud-installed-survives-sync.test.cjs`, `tests/pod-cpu-flavors.test.cjs`.
- `npm run lint` clean on the touched files.
- Fabio, next connect after a restart: strip reads `connecting · offline` + a climbing % for the
  whole boot, the model count never drops to 0, Cancel shows "cancelling…" until RunPod answers.
  A real stall cannot be staged on demand; the 8-min path is proven by the test.

## Current State

2026-10-10, session 01fc9cdf: steps 1-6, the no-toast rule and the Flow hot-store fix are
committed (cebcf95f8). The > 2 GiB upload fix is implemented and tested, NOT committed
(Vision: routes/remoteModels.js, comfy.js, remoteProxyForward.js, remotePodLifecycle.js comment,
docs line, tests/remote-upload-chunked.test.cjs; mpi-ci: wrapper.py 0.2.46 + test_upload_chunk.py).
Runtime 0.2.46 is LIVE ON DEV (not stable). MPI-1044 messaged: its promote now carries this.

2026-10-10 18:32Z: Fabio cancelled the proof connect (5090 Pod x9wjfnumfbnb91, deleted 204):
a 10-40 min home upload billed at GPU rate is not acceptable to him. OPEN DIRECTION, asked:
(A) the Pod pulls the LoRA from its public link at datacenter speed (wrapper
`/wrapper/models/install` already takes any http(s) url + sha; app needs the url: CivitAI
by-hash lookup, or the user pastes it once); (B) a private LoRA uploads on the cheap
"No GPU - download only" CPU Pod (same wrapper, sliced endpoint works ComfyUI-less), once,
since the volume keeps it. Sliced upload stays as B's transport. Noticed: his Cancel logged
`by settings: connect ended without a connection`, not `by settings: Cancel` (17:41 did).

2026-10-10 later: Fabio DECIDED the shape (A is out: CivitAI needs a key + VPN in the UK).
Build "Upload models" (phases U1-U4 below). Big uploads happen on the CPU Pod; the GPU
generate-time auto-upload refuses > 1 GB with a toast that opens the uploader.

Handoff (session 01fc9cdf): the sliced-upload fix is COMMITTED (Vision + mpi-ci). Fabio wants
the next session named for the uploader. Connect-feedback loose ends still open: his Cancel look
(+ the wrong `connect ended` label), the 13 GB volume diff, the release note. A RELEASE before
`promote` would break uploads for released users (stable runtime 0.2.45 has no
/wrapper/upload/chunk); `mpi-release` flags the dev/stable drift.

Next, in order:
1. **Phases U1-U4** (below), then Fabio's 10.27 GB LoRA through the uploader on a CPU Pod.
   Proven -> `./publish-runtime.sh promote`, commit mpi-ci. Watch for a 413/524 on a slice.
2. **Volume 13 GB question.** Listing taken on the 5090 Pod:
   `research/pod-ls-2026-10-10-5090.json`. Top level: mpi_models 130.99 GB, comfyui 0.46 GB,
   cubric ~0. Note 131 GB of models now (volume was 100 GB at 10:12Z: grown, or more installed
   since). Diff `models_files` against DEPS (installed models + engineAsset + nodes) to name any
   file the registry does not know; that is the unexplained part.
3. Fabio's look at the Cancel flow (user-ux), then close-out: release note in
   `docs/releases/UNRELEASED.md` (sat in MPI-1036's claim; check it is free), commit by pathspec.

## Completed

- Steps 1-6 (see checklist.md), all on 2026-10-10.

## Plan Drift

- 2026-10-10: the > 2 GiB cap was not in the route the handoff named but in
  `routes/remoteModels.js` (`remoteUploadModel` AND its twin `remoteUploadInput`, both
  `fs.readFile`), and the wrapper also read the whole body (`await file.read()`). Fixed as one
  sliced path for both (32 MiB raw slices to a new runtime endpoint), not a streamed single
  request: RunPod's proxy runs through Cloudflare (100 s, a likely per-request body cap).
  The dev publish also shipped MPI-936's `model_patches` start.sh line (c57f7dd), which
  MPI-1044 was waiting on.

- 2026-10-10: the Pod-field log uses the v2 Pod shape (`status`, `startedAt`, `cudaVersion`,
  `ssh.proxy`), not the brief's v1 names (`desiredStatus`, `lastStartedAt`, `machine`): the
  client calls `api.runpod.io/v2`, which has no `machine` object.
- 2026-10-10: Cancel also reports a delete RunPod never confirmed (warn hint + toast), since
  "Connection cancelled" over an unconfirmed delete hides a Pod that may still bill.
- 2026-10-10: Fabio (relayed by "Video edit 15"): the slow-connect toast "Setting up the
  engine for your GPU (one time)…" read as "connected" to him and users. Removed; the panel
  hint stays. Row dropped from docs/toasts.md. Then Fabio widened it: NO toast between
  Connect and its outcome. Also removed: "Creating a Pod…/Connecting to your Pod…" (Settings
  click + boot announce), the 5-min "Pod taking too long" warning (panel hint keeps it), both
  "Almost ready" toasts, and the boot slow notice (with `_pollRemoteReady`'s now-dead `onSlow`).
  Kept: ready, every failure, cancelled, and the wait-for-stock notices (the attempt changed
  course; it is not connecting). docs/toasts.md states the rule.
- 2026-10-10: PRO 6000 live connect 10:09:43Z -> ready 10:11:15Z (no stall this time).
- 2026-10-10 (Fabio via "Video edit 15"): Video Edit run 1 spent ~2 min loading H3 while the
  connect prefetch staged it. Cause: a Flow run has `modelId: null`, so
  `_ensureRemoteHotStore` found no files, logged nothing and the Flow read the volume while
  the prefetch copied the same files. Fixed: it stages the run's `flowModelIds`
  (`_hotStoreFilesForModels`, shared with the prefetch). Test in
  tests/pod-identity-hot-store.test.cjs.
- 2026-10-10: volume 89.76 GB vs ~77 GB of known models: `/remote/pod/ls` (Fabio's OK) answered
  `remote_inactive`, Pod deleted at 10:24Z. Next connect -> one call, diff against DEPS.
- 2026-10-10: PRO 4000 live connect 10:04:49Z -> ready 10:07:50Z: phase log + Pod-field log
  both fired as designed (`cudaVersion=13.0 machineAssigned=true` within 1 s of create).
- 2026-10-10: MPI-623's message dropped the brief's "3 models" lead (Fabio: the volume holds
  exactly 3 models). Resolved; the 0 / N fix stands.
