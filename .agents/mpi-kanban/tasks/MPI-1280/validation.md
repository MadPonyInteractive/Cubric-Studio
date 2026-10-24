# MPI-1280 validation

## Cause (Fabio's live log, 2026-10-24)
Nothing held the reply. `generate` returned `started` after the 1 s refusal race, but the reply was
written two model rounds later: the generate result carried the memory nudge, so round 2 was a
`write_memory` (the NOTED line) and round 3 the reply. The Voice rule forbade words alongside a call,
and the loop never showed such words anyway. At ~35-40 s per round on a long chat (describe_model to
submit took 78 s for two rounds), the reply landed after a ~25 s FLUX.3 Turbo render. The user's
second message was held behind that turn (D4), which is why its bubble came first. An independent
read-only audit ruled out Stop (MPI-1165), the typed-verdict rules (MPI-1226, MPI-1032), wakes, the
GPU yield, the auto-look, the unfinished ledger, the spend gate and the chat's event buffering.

## Fix
- Voice rule: a generate, gif or run_routine call carries the reply, one or two lines on what starts.
- Loop: those words wait for a call to pass its refusal race (`_sayStarted`, generate, routine and
  gif paths), are dropped if every call was refused, and a round that spoke and whose calls all
  started ends the turn. The memory nudge it could not answer is read next turn (`MEMORY_LATER`).
  No empty bubble after a spoken line. A call sent with no words keeps the old shape.
- Memory rule: the note goes in the same message as the job.
- System prompt budget 12,504 -> 12,840 (+336), logged in `tests/agent-prompt-budget.test.cjs`.

## Tests
- 7 tests in `tests/agent-loop.test.cjs` "MPI-1280 say-and-start", including model rounds slower
  than the render, Stop after the line, a call with no words, a mixed refused/started round.
- Run against a clean copy of HEAD (old code): the 4 behaviour tests fail for the right reason
  ("the line was already in the chat when it landed" false), the 3 old-shape guards pass.
- `npm run lint` clean; `npm test` 3,602 tests, 0 fail (before the 4 audit-driven tests were added;
  `tests/agent-loop.test.cjs` 225/225 after).

## Bench, MiMo-V2.6-Flash, 55 cases x1 (research/)
DeepInfra was slow (~150 s a case against 15-40 s on 2026-10-20). First pass 49/55. Re-runs of the six:
check-in-proceeds and over-boxed-head pass (their fails were DeepInfra errors); shape-then-edit hit the
180 s DeepInfra timeout twice (0/3 and 1/3 before this change); video-limit and sheet-from-words fail as
they did 1-in-3 before. Score 51/55 with one infra-blocked, against the recorded median 52.
ask-first went 1/4 (3/3 twice before): runs 2 and 3 asked for the settings and generated only after the
answer, but the reply carried no "?" (the check is literal); run 1 sent its question as a garbled
`[options:` tool call. Not shown to be caused by the change (that turn starts nothing), not ruled out.
Billed about $0.064 in all (approved $0.07). The start line is visible in the bench replies, e.g.
"Starting the character sheet now with the sea captain's description".

2026-10-24 follow-up: ask-first drop judged NOT caused by the change. In all 4 failed runs turn 0 started nothing and asked for the settings; the new Voice exception applies only to a message that calls generate/gif/run_routine, which turn 0 never does. The same no-'?' fail happened before this change (MPI-1125 #3, MPI-1208). The grader's literal '?' is the fault: MPI-1281. No paid re-run needed.
