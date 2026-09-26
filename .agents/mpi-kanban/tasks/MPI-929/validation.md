# MPI-929 Validation

Session e1d3639f, 2026-09-26, with MPI-928 (umbrella MPI-932 Phase 3b).

Root cause: a cloud Stop aborted the fetch, so the job settled through `exec.onError` ->
`generation:error`. The gallery's error handler ran `_rebuildAfterEnd` with the tempId, which
deletes the held cancelled placeholder and removes the card - the `cancelled` clip was cut before
it could play. A local Stop ends through a second `generation:cancelled`, which leaves it. The
local pre-dispatch Stop (`onError('cancelled_before_dispatch')`) had the same hole.

Fix: `generation:error` leaves a placeholder that is mid walk-off (`isCancelled`) to
`cancel-shown`, like the cancelled handler already does.

Since MPI-928, a cloud Stop AFTER the POST keeps cooking and lands the paid result - no walk-off
by design. The clip plays for a Stop before the send.

- tests/desktop/cancelled-mascot.spec.js case 4 (Stop, then generation:error: clip still plays
  past 0.5 s, then goes): FAILED against HEAD's MpiGalleryBlock.js (spec.js:106), PASSED with the
  fix. Whole spec (cases 1-5) PASSED.
