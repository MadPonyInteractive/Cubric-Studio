# MPI-928 Plan - a Stopped cloud job still lands the result it paid for

## Decision

Fabio, 2026-09-25: **option A.** A cloud (DeepInfra) Stop cannot un-bill, so the paid result
lands as a normal gallery card, marked as already charged. This matches the local twin, where
a result that finishes after Stop is kept (generationService "store honors the save (R09)").
Rejected: B (turn Stop into an "already paid" note once submitted), C (drop the card, toast
with a recovery link).

## Approach (to confirm when the card is picked up)

1. Stop on a cloud job keeps the job alive server-side: `routes/deepinfra.js`
   `/deepinfra/generate` is not tied to the renderer abort, and the output parks at
   `/deepinfra/output/:id`.
2. Renderer: `js/services/cloudExecutor.js` (the client fetch abort, ~:26) and the settle path
   (`_settleCancelled`) must not drop a cloud result; land it as the card instead, with an
   "already charged" note.
3. Interacts with MPI-929 (the cancel mascot on cloud jobs): the Stopped placeholder must not
   play `cancelled` and vanish when the result is still coming. Do 929 and 928 together.

## Verification

**Verify mode:** user-ux. A spec stubs a slow DeepInfra route, Stops it, and asserts the card
still lands; then Fabio Stops a real cheap cloud run live.
