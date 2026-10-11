# MPI-1076 validation

## (1) "<GPU> connected." with no connect, as a generation finished

Proven from app.log (2026-10-11): boot reconnect ready 07:59:30Z; generate-time LoRA upload
08:00:14Z to 08:01:53Z (0.46 GB, 100 s); then `remote install engine:assets` ran AGAIN at
08:02:08Z. That heal runs only on the connect edge (shell.js `_wasRemoteConnected`), so the
feed dropped the connected Pod to local during the upload (3 missed ticks; uploads were not
in its keep-alive, downloads were) and "reconnected" after it. notificationService latched
the same rising edge and toasted "<GPU> connected." as the waiting generation started.
The drop itself left no log line: the unnamed feed emit changes no phase.

Fix: notificationService toasts only `remote:connection` carrying `announce: true` (Settings
Connect and the boot reconnect, on ready), which also removes the double with each flow's own
"Remote engine ready". The feed counts a live upload as keep-alive and logs
`feed: Pod stopped answering (N misses)` when it does drop a connected Pod.
Not run live: needs a paid Pod. Checked by tests/toast-truth.test.cjs (source).

## (4) "uninstalled" on removed 0

`gone` now counts already-absent files only when nothing was kept; removed 0 with files kept
falls to the "files kept" branch. Decision re-run in the test on the Wan 2.2 case. The
Library's partial-forever display is MPI-1078 (MPI-1079 was a duplicate of it, closed).

## (5) generate-time upload toasts

Start toast removed (comfyController). Generate-time jobs carry `atGenerate: true`
(routes/remoteUploads.js uploadAndWait), passed through the snapshot by downloadService;
notificationService skips them on `upload:finished`.

## (6) reading time

MPI-542 (e5e221411) changed MpiToast's default but never touched StatusBar.notify
(`duration = 6000`) or the four ui:* relays (passed 6000), so the rule reached almost no toast.
Both now pass undefined. tests/toast-reading-time.test.cjs guards it.

## (7) a queue of two said "Generation finished." twice (Fabio, 2026-10-11)

The coalescer flushed on generationQueueCount 0, but the store frees the last item lane when
ComfyUI returns and the item then saves before activeGenerations.end() + generation:complete.
A save over the 150 ms defer flushed item 1 alone; item 2 flushed again. Reproduced first:
tests/notification-batch-saving.test.cjs failed on the old code (fired ["Generation finished."]
while item 2 was still saving). Fix: drained = count 0 AND no run registered; error/cancelled
re-arm the flush. generationService now ends a run whose onComplete throws (it leaked before, and
would now mute the toast). npm test 3097 pass, 0 fail.

## Tests

`npm test`: 3095 pass, 0 fail (before the two new files were counted in that run's
toast checks: 7/7 in toast-truth + toast-reading-time). tests/remote-engine-assets.test.cjs exit 0.
