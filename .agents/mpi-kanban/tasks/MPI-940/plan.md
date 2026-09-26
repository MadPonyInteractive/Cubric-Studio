# MPI-940 Plan - Cloud send window, then prompt-box cloud batch of N

## Current State

(2026-09-26, session ab9e6fd6) Card created and planned; nothing built. Next action: Phase 1.
Design agreed with Fabio in chat (see description). Two phases, one card: the window protects
every cloud run on its own and ships first; the batch builds on it.

## Phase 1: the send window (~3 s)

**Where:** `js/services/cloudExecutor.js`, the async head (~:207-296). A Stop before the POST
already aborts free (`exec.cancel`, `stopKeepsResult` false; `_settleCancelled`, MPI-928). Add ONE
cancellable wait before `generationStore.advance(jobId, PHASES.SUBMITTING)`: resolve after the
window OR on `controller.signal` / `generationStore.getSignal(jobId)` abort, then re-run the
existing aborted check. Nothing else in the cancel path changes.

- Length: one named constant, 3000 ms. ponytail: a setting only if Fabio asks.
- Visible: the card shows a "Sending in 3..." countdown while it waits. Find how the cloud card
  shows its pre-send state today (MpiGalleryGrid / generation card placeholder; `onPromptAck`
  starts the clock at send, MPI-929) and add the countdown there. Mascot on the card is
  optional polish - ask Fabio.
- Local runs: untouched. Agent cloud runs: get it too (same executor), fine by design.
- Price shown on Cue is unchanged.

**Verify:** unit test on the executor: Stop inside the window -> no fetch to
`/deepinfra/generate`, card cancelled, no charge; no Stop -> fetch fires after ~3 s.
Existing `tests/cloud-executor.test.cjs` is the home. Then Fabio: Stop within 3 s on a cheap
cloud model (FLUX Schnell) -> nothing billed on DeepInfra.

## Phase 2: prompt-box batch of N for cloud models

Today the box's batch control shows only where `modelShowsBatch` passes, and every cloud model
but FLUX Schnell and Veo has `capabilities.batch: false` (native batch via `batchFieldFor`,
`deepinfraSizing.js:74`; `cloudRunFields` clamps to it, `cloudExecutor.js:89`).

- Show the batch control (1..4) on cloud models with no native batch. Decide the gate: a new
  capability (e.g. `fanOutBatch`) vs "every cloud model" - keep `capabilities.batch: false`'s
  meaning (native batch) intact, since local models rely on it.
- A batch of N with no native batch = N single cloud runs sent together after ONE shared window,
  all N cards drawn up front. Prior art: the agent's fan-out (`services/agentLoop.mjs` `_fanOut`
  :1037, `js/shell/agentDispatch.js` :582 `extraTempIds`/`extraPlaceholders`). First decision for
  the session: fan out in generationService (N jobs) or in the gallery dispatch - pick the one
  where Stop already reaches every job.
- Cue price reads xN (N bills). Native batch stays one bill (`cloudExecutor.js` :81 comment).
- Stop in the window kills all N free; after it each card keeps what it paid for (MPI-928/929).
- Badge shows xN (MpiPromptBox `_renderBadge` reads the mounted `batch` control).

**Verify:** unit test for the fan-out count and the xN price; Fabio in the app: batch 4 on a cheap
cloud image model -> four cards at once, four results; Stop within the window -> nothing billed.

**Verify mode:** user-ux (Fabio checks both phases in the app; it spends real money).

## Completed

(none)

## Plan Drift

(none)
