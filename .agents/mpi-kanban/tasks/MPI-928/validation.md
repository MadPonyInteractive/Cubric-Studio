# MPI-928 Validation

Session e1d3639f, 2026-09-26, with MPI-929 (umbrella MPI-932 Phase 3b). Option A (Fabio).

Fix: `cloudExecutor` sets `exec.stopKeepsResult = true` as the POST is sent; from then on a Stop
(`exec.cancel` and the store's `interruptCb`) cancels the store job but no longer aborts the fetch,
so the provider's billed result reaches `onComplete` and lands through the R09 path.
`generationService` stamps `generationSettings.chargedAfterStop` when a cancelled run carries a
cost. `activeGenerations.cancel` sends `resultComing` on the Stop event; the gallery holds the
placeholder cooking (no walk-off) until the late complete or error takes it.
A Stop before register() now settles cancelled without sending (it used to POST an aborted fetch).

- tests/cloud-executor.test.cjs: 2 new (Stop after send lands the paid result with cost + store
  `cancelling`; Stop before send sends nothing, settles CANCELLED) - red first, then 25/25 PASSED.
- tests/desktop/cancelled-mascot.spec.js case 5 (Stop with a result coming: no cancelled clip,
  card cooks until complete) PASSED.
- npm test 1948/1949 (0 fail); eslint clean on the four touched files.

Open: the card badge ('CHARGED AFTER STOP') needs MpiGalleryGrid.js, claimed by live peer
45d5d1c4 (MPI-867) - message 3262a854. Live Stop: see below.

Folded in 2026-09-26 (Fabio saw it live: a ~10 s Seedream edit card read "1s"): the card clock
starts on onPromptAck, which cloudExecutor fired only after the blocking fetch returned - and our
route answers only once the provider has finished. Every cloud card timed the tail (~1 s). The ack
now fires as the POST is sent (Fabio: the counter runs from pressing Cue to the image landing).
- tests/cloud-executor.test.cjs 'the card clock starts when the run is SENT': FAILED with the old
  ack placement, PASSED with the fix; file 26/26.

Live 2026-09-26 (Fabio, reloaded :3000): Seedream 4.5 edit, Stop pressed right after Cue - the card
kept cooking and edit_001 landed (the paid result kept). The pre-send window is too short to hit by
hand; that branch is held by the unit test.

Decision 2026-09-26 (Fabio): cloud only. The LOCAL card clock stays as is (starts at the engine's
prompt ack, past cold-start boot).
- Timer live 2026-09-26: Seedance 1.5 Pro i2v_001 (cloud) card reads 44s. PASSED.
- Badge: MpiGalleryGrid.js top-left badge gets a 'CHARGED AFTER STOP' row (--accent-warn) when
  generationSettings.chargedAfterStop; mascot spec case 6 (charged card shows it, a plain card
  does not) PASSED; spec cases 1-6 PASSED; eslint clean.
- CI: run 36228475482 on 5a74d23e SUCCESS (2026-09-26). Closed.
