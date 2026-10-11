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
the next session named for the uploader. Fabio's Cancel look is DONE (RunPod deleted in <1 s,
so "cancelling…" never showed: the expected fast path). Still open: the wrong phase-log label
(`connect ended without a connection` instead of `Cancel`, from `_connectEngine`'s finally),
the 13 GB volume diff (OFFLINE against the saved research/pod-ls-2026-10-10-5090.json, no Pod;
strays get deleted later with the uploader's Delete), the release note. A RELEASE before
`promote` would break uploads for released users (stable runtime 0.2.45 has no
/wrapper/upload/chunk); `mpi-release` flags the dev/stable drift.

2026-10-10 ~20:25Z, session 11c1e888 ("Upload models 1"): **U1 DONE, uncommitted.**
`routes/remoteUploads.js` (new, mounted in the `routes/remoteProxy.js` barrel because
`server.js` is held by MPI-1069): `GET /remote/user-models?type=` -> `{local:[{rel,sizeBytes}],
remote:[{rel,sizeBytes,partial,managed?}]}`; `GET /remote/uploads` -> `{jobs}`; `POST
/remote/uploads {type, files:[rel]}` -> `{jobs, skipped:[{rel, reason: already_on_pod |
already_queued | not_found}]}` or 400 `volume_full` (toast:true); `POST
/remote/uploads/:id/cancel` (answers once settled; a running one's `.part` is deleted); `POST
/remote/user-models/delete {type, filename}` (409 `managed_by_app` for a DEPS weight). Job wire
shape `{id,type,filename,totalBytes,sentBytes,status,error}`; SSE `upload:snapshot {jobs}` on
each status change + on stream connect (downloadManager stream handler), `upload:progress
{id,sentBytes,totalBytes}` per 32 MiB slice; terminal jobs drop after 60 s. `/remote/upload/model`
answers 409 `too_big_for_gpu` (> 1e9 bytes, `!noGpu`) with user-ready text; comfyController
throws it verbatim (U3 adds the toast action). Wrapper 0.2.47 `GET /wrapper/models/list?type=`
in mpi-ci (uncommitted, NOT published); an older runtime -> app error `runtime_too_old`.
Tests: tests/remote-uploads.test.cjs (6), mpi-ci test_models_list.py. Docs line for
`docs/runpod-remote-engine.md` waits: MPI-1069 holds it.

U2 DONE + ACCEPTED by Fabio (download row live, Cancel removes the row; layout "fine"), committed
at handoff: Transfers section rendered INSIDE
`MpiQueuePanel` (grid row 3, `hidden` when empty), `MpiProgressBar` + Cancel per row; downloads
from `state.downloadJobs` (live statuses, not `__universal_workflow__`), uploads from new
`state.uploadJobs`. `downloadService`: `upload:snapshot` / `upload:progress` listeners (toast on
complete/failed, rows in docs/toasts.md), `uploadModels(type, files)`, `cancelUpload(id)`; the
panel calls `_ensureSSE()` on mount so a reload mid-upload restores rows. Proven on an
app:isolated instance with injected jobs (render, progress patch, hide when empty, download row)
and `curl` of the stream (connect sends `upload:snapshot`).

2026-10-10 ~22:25Z, session 6d3f1208 ("Upload models 2"): **U3 BUILT, uncommitted, Fabio's
look pending.** `js/utils/pathTree.js` (tree builder, now shared by MpiTreePicker + the new
`MpiFileTree` Primitive: inline multi-select, per-row note). `MpiModelUploader` Compound +
`openModelUploader({type})` singleton (same module): tabs LoRAs / Upscale models, left local,
right Pod list + live jobs (queued / %), Upload under the left, Delete under the right (cancels a
live upload, else `/remote/user-models/delete`), managed rows disabled, coded refusals in plain
words (`REFUSALS`). Button "Upload models" in MpiRunpodSettings Storage, enabled on
`status.ready`. `too_big_for_gpu` is now a coded error (comfyController) with its own
commandExecutor branch: warning toast + action button that opens the overlay on that tab
(before, it fell through to the bug-report dialog). Proven on an isolated instance with
headless `playwright-cli` (validation.md). **Do not drive the Claude browser pane against the
full app: twice this session Claude Code crashed while doing it; playwright-cli headless from
Bash is safe.**

2026-10-11 ~00:05Z: upload PROVEN (10.27 GB, 37.5 min, CPU Pod); 8-min stall cap PROVEN LIVE
(fired at 8:00, delete 204); upload completion now goes through notificationService (OS
notification when unfocused). Stale "Settings → RunPod" copy (RunPod moved to the Remote panel
in MPI-728) fixed in comfyController / engineGate / MpiLlmSettings; **7 strings left in
`js/shell.js`** (lines ~812, 1052, 1091, 1110, 1166, 1172, 1217 "Open Settings, RunPod", 1507):
the file was claimed by MPI-1065 (9bbf1e2f) at the time. Say "Remote", same as the others.

2026-10-11 ~00:15Z, session 7ea70332 ("Upload models 3"): GPU proof BLOCKED on RunPod, not us.
Tonight's GPU Pods in EU-RO-1 (maduch90z92qjf, xbiazswls7f5x7, ~5 more by Fabio) never started:
System logs empty, and Docker Hub's `tag_last_pulled` for v0.26.0-dev-cu130 stayed at 18:31:17Z
(the cancelled 5090), so no host even pulled. Same tag booted ready in 1-3 min at 10:04/10:09/10:57;
morning 08:33-09:34 had 4 stalls in a row too. Retry tomorrow. Messaged MPI-1065
(`7ea70332-mpi1057-to-mpi1065-shelljs`) to release js/shell.js.
Stall copy (Fabio, 2026-10-11): say the DATA CENTER looks troubled, suggest another data center or
"Any region (no volume)" (the ephemeral option's label). DONE in the panel hint
(MpiRunpodSettings.js `_stalled` branch). MPI-1065 released js/shell.js (owner session was
"No background. Qwen 2.1 / 3", not "GPU Pod blocks project opening"). shell.js pass DONE,
uncommitted: every "Settings → RunPod" now "Remote"; both never-started dialogs carry the
data-center text; `_announceStall` emits `remote:stalled` -> notificationService OS
notification when unfocused (tests/remote-stalled-notify.test.cjs, docs/toasts.md row). Also
dropped two stale docs/toasts.md rows for the download-only warning MPI-1070 deleted.
Left: GPU-Pod LoRA generation -> promote, phase-log label, 13 GB diff, release note.

2026-10-11 ~07:55Z: LoRA PROVEN on a GPU Pod (no re-upload, LoRA applied) and runtime
PROMOTED (stable = 0.2.47). Same session, uncommitted, all tested: (a) stale remote-restart
toast fixed (`comfy:restarted` after the connect-time node restart clears the renderer flag);
(b) MPI-1065's missing-files toast shortened (Fabio); (c) generate-time uploads now run
through the Upload models queue (`uploadAndWait` in remoteUploads.js), so they show in
Transfers with a bar + Cancel; Cancel -> 409 `upload_cancelled` -> info toast, no bug dialog.
Fabio SAW (c) live (456 MB row with MB + Cancel; log "upload loras/...: complete"). (d) Transfers
now hides silent internal jobs (`downloadService.isSilentJob`, MPI-576) and labels Flow/plugin
downloads via `jobDisplayName`: Fabio saw a raw `engine:assets` row; fixed, lint + tests only.
13 GB question ANSWERED: every volume file is a known dep; the extra is the scene-path plugin's
Wan encoder/VAE + a universal Krea2 encoder -> Model Library loop, card MPI-1078. Toast audit
card MPI-1076; dead-Pod-in-seconds card MPI-1075 (Fabio started it in another session).
Left (all small, then CLOSE the card via mpi-end-session): phase-log label (`_connectEngine`
finally logs "connect ended without a connection" for a stall/cancel, MpiRunpodSettings.js),
release note in docs/releases/UNRELEASED.md, docs/runpod-remote-engine.md upload-routes line.

Next, in order:
1. **U4 last step**: a GPU-Pod generation with `sulphur_lora_rank_768` (no "Uploading…" toast =
   the flat Pod copy was found). Proven -> `./publish-runtime.sh promote` (0.2.47 to stable).
   Then the shell.js copy above once MPI-1065 releases it.
2. **Stall cap: OS notification when unfocused** (Fabio, 2026-10-11): `_announceStall` in
   `js/shell.js` (~1211) shows only the in-app "Pod never started" dialog. Emit an event there
   and let `js/shell/notificationService.js` send `notify-connection-complete`-style OS
   notification when `!document.hasFocus()` (same split as `Pod connected` at ~208 and the new
   `upload:finished`); keep the dialog for when he returns. Same shell.js claim wait.
2. **Volume 13 GB question.** Listing taken on the 5090 Pod:
   `research/pod-ls-2026-10-10-5090.json`. Top level: mpi_models 130.99 GB, comfyui 0.46 GB,
   cubric ~0. Note 131 GB of models now (volume was 100 GB at 10:12Z: grown, or more installed
   since). Diff `models_files` against DEPS (installed models + engineAsset + nodes) to name any
   file the registry does not know; that is the unexplained part.
3. Fabio's look at the Cancel flow (user-ux), then close-out: release note in
   `docs/releases/UNRELEASED.md` (sat in MPI-1036's claim; check it is free), commit by pathspec.

## Completed

- Steps 1-6 (see checklist.md), all on 2026-10-10.
- U1 backend, 2026-10-10 (uncommitted; see Current State).
- U2 Transfers (accepted), U3 overlay (built, look pending), 2026-10-10.

## Plan Drift

- 2026-10-10 (Fabio, decided): uploads stay FLAT on the Pod (basename, no folders, no move).
  App-installed weights live in folders, so a loose file in the LoRA picker reads as "yours";
  users will not upload hundreds. Do not re-raise folder support.

- 2026-10-10 (U3): `buildTree` moved to `js/utils/pathTree.js` (two Primitives may not import
  each other). The 1 GB toast needed a coded error + a commandExecutor branch, not just an
  action: the uncoded error reached the bug-report dialog. Overlay opens through a module
  singleton, so the toast (a service) reaches it by dynamic import with no Settings mounted.

- 2026-10-10 (U2): no `MpiTransferList` Compound. A Compound may import Primitives only, so
  it could not mount inside the `MpiQueuePanel` Compound; and `preloadStyles.js` + `types.js`
  were held by MPI-623. The section lives in `MpiQueuePanel` (same CSS file).

- 2026-10-10 (U1): added beyond the plan: `GET /remote/uploads` (the job list, for a poll and
  the test), and a `managed` flag + 409 on delete for weights the app installed itself
  (deleting one through the uploader would leave its install state lying until the next
  check). A file already complete on the Pod is refused, so a cancel can delete its `.part`
  without touching a finished copy.

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
