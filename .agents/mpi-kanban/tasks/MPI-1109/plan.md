# MPI-1109 - Online Describe shows it is working (gallery + Cosmo)

Umbrella: MPI-1102. Rule: `.claude/rules/dos_and_donts.md` "Every action shows itself".

## Approach (Fabio, 2026-10-17)

Not a Transfers row. Online Describe works the way cloud (DeepInfra) generations already do:
it goes into the generation queue on the `cloud` lane, so it runs beside a local or Pod job
and shows as a queue row + status bar with Stop. Reuse the lanes; build no new queue.

- `js/services/describeExecutor.js` (new): `runCommand`'s twin for an `imageDescribe` sent to
  the Language Models connection (`/llm/describe`). Same shape as `toolExecutor.js`: one POST,
  registers on the `cloud` lane, pulses, every exit reaches a terminal store phase, Stop aborts.
- `js/services/generationService.js`: a config carrying `describeEndpoint` takes the `cloud`
  lane (`_laneOf`, queue badge) and the new head (exec factory).
- `js/services/llmService.js` `describeImage`: opt-in `queued: true` sends the endpoint branch
  through `enqueueGeneration`. Internal callers (child-safety picture look, kept-looks captions)
  stay direct: they are steps inside a job that already shows, and queueing them on the cloud
  lane would hold a local gen's safety check behind a running DeepInfra video.
- `js/utils/describeAction.js`, `js/shell/agentDispatch.js`: pass `queued: true`.

Ownership: js/services/describeExecutor.js, js/services/generationService.js,
js/services/llmService.js, js/utils/describeAction.js, js/shell/agentDispatch.js,
tests/desktop/describe-queue-row.spec.js

## Verification

**Verify mode:** auto

- Desktop spec `tests/desktop/describe-queue-row.spec.js`: endpoint backend, `/llm/describe`
  held open by a stub; the queue shows a running Describe row; on answer the row leaves and the
  caption reaches the prompt box.
- `npx eslint` on the touched files.

## Current State

2026-10-17: implemented and verified (validation.md). Uncommitted. Next: commit by pathspec,
push, card done on green CI. Known trade-off: the cloud lane runs one job at a time, so an
online Describe waits behind a running DeepInfra generation (same as two cloud gens).
