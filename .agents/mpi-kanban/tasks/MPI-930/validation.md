# MPI-930 Validation

Session 667f09c0, 2026-09-26, together with MPI-931 (same file, umbrella MPI-932 Phase 3a).

Fix: `exec.cancel()` before register sets `exec.cancelRequested` instead of a bare interrupt; right
after register the job runs `generationStore.cancel(jobId)` and `_abortedBail()`, so the store
reaches `cancelled`, `onError('cancelled_before_dispatch')` fires, and no /prompt is POSTed.

- `tests/desktop/cancel-targets-own-prompt.spec.js` test 1 PASSED; FAILED against HEAD's code
  (the job ran on to "No workflow registered..." instead of cancelling) - red first, then green.
- Related: cancelled-mascot, flow-queue-hotkey, gif-cutout, gallery-generating-mascot, agent-chat
  41/41 PASSED; generation-store + cloud-executor unit 24/24 PASSED; eslint clean.
Fabio's live check: PENDING.
