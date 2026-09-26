# MPI-940 Plan - Cloud send window, then prompt-box cloud batch of N

## Current State

(2026-09-26, session 5cae2625) DONE. Both phases verified by Fabio in the app; code in 2779cfcf.
Fabio 2026-09-26: batch STAYS `scope: 'shared'`, even though an SDXL batch of 4 carries to a
cloud image model (x4 money); the price tag and xN badge show it. Do not re-raise.

How Phase 2 landed - fan-out in the EXECUTOR, not N Cue jobs (Plan Drift below says why):
- `cloudRunFields` returns `calls` (N where the endpoint has no native batch, else 1) beside
  `batch`; `estimateRunCost` prices `batch * calls`. Cap 4 (mirrors AGENT_BATCH_MAX).
- The executor sends `calls` POSTs with `Promise.allSettled` after the ONE window: fixed seed
  steps +i per call; every call carries the WHOLE batch's `estimateUsd`; partial failure lands
  the survivors + one `ui:warning`; all failed = one `_settleFailure`. `outputInfo.seeds[i]` ->
  generationService `_seedOf(i)` so each card's sidecar has its own seed.
- `modelShowsBatch` returns true for any `model.provider`; `visibleControlIds` appends `batch`
  for a cloud model when the op lists none (t2v/i2v/edit). Knock-on: `agentCanBatch` now allows
  every cloud op, so the agent's `count` on cloud is one parallel job (test updated).

Phase 1 notes:

How Phase 1 landed (not obvious from the diff):
- `sendWindow = { ms: 3000 }` in `cloudExecutor.js` is an object only so the test can shrink it;
  `tests/cloud-executor.test.cjs` pins it to 0 for every test not about the window.
- The wait loops in 1 s steps and emits `generation:send-countdown { id: genId, seconds }`
  (then `seconds: 0` right before the POST). It wakes on `controller.signal` only: every Stop
  before the POST aborts the controller (`exec.cancel` and the store's `interruptCb`).
- Card: MpiGalleryBlock routes the event by `activeGenerations.get(id)` tempIds ->
  `grid.el.setSendCountdown` -> card `nameEl` "Sending in N...". The grid keeps a
  `_sendCountdowns` map because the first tick beats its 16 ms debounced render.
- Gallery cards only. A history-mode (groupHistory) cloud run waits too but shows no countdown.

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

- 2026-09-26 Phase 1 built: `cloudExecutor.js` window + countdown event, `MpiGalleryBlock.js`
  route, `MpiGalleryGrid.js` card label; 3 new tests in `tests/cloud-executor.test.cjs`
  (30/30 pass). VERIFIED by Fabio in the app.
- 2026-09-26 Phase 2 built: executor fan-out, per-card seeds, batch gate for cloud models.
  Awaiting Fabio's in-app check.

## Plan Drift

- 2026-09-26: Phase 2's "fan out in generationService (N jobs) or in the gallery dispatch"
  was neither. The Cue runs ONE job per lane (`_dispatchNextCue`, cloud lane included), so N
  jobs would run one after another, not in parallel. Fanning out inside `runCloudCommand` keeps
  it ONE job: one window, one Stop reaching all N, one lane slot, and generationService already
  treats N urls from one exec as a batch (N cards, placeholders from `Input_Batch_Size`).
