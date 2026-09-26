# MPI-930 Validation

Session 667f09c0, 2026-09-26, together with MPI-931 (same file, umbrella MPI-932 Phase 3a).

Fix: `exec.cancel()` before register sets `exec.cancelRequested` instead of a bare interrupt; right
after register the job runs `generationStore.cancel(jobId)` and `_abortedBail()`, so the store
reaches `cancelled`, `onError('cancelled_before_dispatch')` fires, and no /prompt is POSTed.

- `tests/desktop/cancel-targets-own-prompt.spec.js` test 1 PASSED; FAILED against HEAD's code
  (the job ran on to "No workflow registered..." instead of cancelling) - red first, then green.
- Related: cancelled-mascot, flow-queue-hotkey, gif-cutout, gallery-generating-mascot, agent-chat
  41/41 PASSED; generation-store + cloud-executor unit 24/24 PASSED; eslint clean.
Fabio's live check (2026-09-26): the first run (06:57Z) exposed a hang - a prompt deleted while
PENDING never reached a terminal event, so the held agent submit waited 30 min. Fixed in 47912cc1
(comfyController.deleteQueueItem replays execution_interrupted for it; a Stopped card reads
"Cancelling..."). CI run on 58138dcb (carries 47912cc1) SUCCESS. Re-run 2026-09-26 on an isolated
instance (:56442) against his shared engine while his render 9133c21b ran: `cancel_check.py queued`
-> our pending 3623009d cancelled, held submit resolved CANCELLED in 1.1 s, pending queue empty,
HIS RENDER SURVIVED. PASSED.
- CI: run 36223262806 on 2380ed6a SUCCESS (2026-09-26).
