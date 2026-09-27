# MPI-516 validation

Built 2026-09-27 (session 56a78131, one worker + review), 2.0 Gate A item A2 of MPI-595.

## Root cause

`comfyController._reconcileFromHistory` returned early whenever a prompt was absent from
`/history`, which is also what a still-running prompt looks like, so a prompt ComfyUI had lost
was never recognised. The remote `/history` poll therefore spun forever on it, and the local
engine had no poll at all.

## Fix

- `_checkVanishedPrompt` (ported from `scripts/smoke-workflows.mjs` `orphanReason()`): absent
  from `/history` AND from `/queue` (running + pending) while both reads succeed means gone.
  **The MPI-450 guard is ported with it**: `/history` is re-read AFTER the queue read, so a
  prompt that finished between the two reads is not declared lost. A failed read is "unknown",
  never "absent". 30 s grace from submit, the runner's own `ORPHAN_GRACE_MS`.
- `_startHistoryPoll` now runs on BOTH engines (the remote-only early return is gone) and calls
  the detector each tick after the reconcile.
- The reject carries `code: 'prompt_vanished'`. `commandExecutor` turns it into a warning toast
  ("Generation lost"), beside `engine_dropped`, instead of falling through to the bug-report
  dialog: the engine lost the job, not our code.

## Evidence (agent-verified)

- `tests/comfy-vanished-prompt.test.cjs`, 13 tests: vanished -> rejects; finished between the
  reads -> no reject; queue unreadable -> no verdict; history re-read unreadable -> no verdict;
  running / pending -> waits; inside the grace window -> waits; settled by a live event during
  the awaits -> no double reject; the commandExecutor branch sits before the generic fallback
  and emits `ui:warning`; plus structural checks on the poll wiring and `_promptStartTimes`
  cleanup.
- **Mutation checks, both run by the reviewing session:** removing the re-read guard turns
  exactly the false-positive test red (11 pass / 1 fail), restored 12/12; renaming the
  commandExecutor branch code turns the UX test red, restored.
- `npm test` 2090 pass / 0 fail / 1 skipped (pre-existing), before the commandExecutor branch;
  the two affected files re-run after it, 17/17 with `engine-dropped-not-oom`.
- `eslint` clean on both service files.

## Not run

A live repro (kill a local engine mid-generation and let the WS reconnect to the new process,
or wipe the queue from ComfyUI's own UI) needs a GPU generation in an isolated app. The detector
reads the same `/queue` and `/history/{id}` routes the controller already uses on both engines
(`comfyController.js` Stop / cancel paths), so the unit harness exercises the real request
shapes.
