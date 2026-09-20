# MPI-840 - validation

## Automated (2026-09-20, uncommitted at time of writing)

- `node --test tests/agent-sessions.test.cjs` -> 20 pass. New: a queued turn waits, runs in order,
  in its own conversation; a turn that throws still hands on; `reset` drops a conversation's queued
  turns; the route reads `busy()` after staging and never answers BUSY.
- `node --test tests/agent-loop.test.cjs` -> 63 pass, 1 skipped (live key). New: `write_memory` on
  the unfinished ledger answers `APP_OWNED_NOTE`, never reaches the file, and the step no longer
  claims "Noted".
- `npm test` -> 1538 tests, 1537 pass, 0 fail, 1 skipped. `npm run lint` clean.

## Live round 1 (Fabio, 2026-09-20 ~10:26Z, after restart at 10:25:05Z)

- MPI-839 placeholder: PASSED. He switched away mid-render and back; the spinner showed only in
  "Cowgirl on a Bull", the project it was asked in.
- FOUND: "Scratch that. Leave it." was meant to cancel the queued anime clip. The agent could not
  (no cancel tool), said it was leaving it running, and it rendered. app.log: submits 10:26:49Z and
  10:27:18Z, his own Stop of the first at 10:28:02Z (CANCELLED), then the anime one promoted.

## cancel_generation - automated (2026-09-20, uncommitted at time of writing)

- `tests/agent-loop.test.cjs`: his scenario replayed - two clips in flight, "Scratch that" cancels the
  LATEST, the first stays in flight and in the ledger, the cancelled one leaves the ledger and is
  not reported as a failure; an unknown id reaches nothing; nothing in flight says so.
- `tests/agent-generation-relay.test.cjs`: real router, fake renderer - a submit goes out under its
  `requestId`, `/connector/cancel` relays `generation.cancel`, the held submit resolves CANCELLED;
  DUPLICATE_REQUEST_ID, INVALID_REQUEST_ID, NOT_IN_FLIGHT, 400. Renderer wiring pinned on source.
- `tests/agent-no-delete.test.cjs`: `POST /connector/cancel` added to the allowlist ON PURPOSE, with why.
- `npm test` -> 1546 tests, 1545 pass, 0 fail, 1 skipped. `npm run lint` clean.

## OWED - Fabio's eyes, one app restart

Ask for a clip, then a second one, then "scratch that". The second must be cancelled (its placeholder
goes, the Cue count drops), the first keeps rendering, and the chat step reads "Cancelling a
generation". Not checkable from a test: it needs the real queue and a real render.

Type a second message while the agent is answering. It must show in the chat at once and be answered
after the current reply - not refused. It does NOT interrupt: a correction to a generation already
sent arrives after the dispatch.

## Live round 2 - BOTH PASSED (Fabio, 2026-09-20, restart at 10:43:31Z). Read off app.log, not the chat.

- 10:44:52Z `generation.submit` ddf06c78 (cowboy -> motorbike, H3). 10:45:09Z `generation.submit` 286ea5e0
  (anime robot, ILL Anime). The job ids are now the agent's own toolCallIds, i.e. the `requestId` rode through.
- QUEUE: "You know what? Cancel the robot." was typed WHILE the robot turn was still running (the chat shows
  it between "Reading: guide:illustrious" and "Starting generation"). It was accepted, shown at once, and
  answered after that turn ended. Before MPI-840 it was refused BUSY and lost.
- CANCEL: 10:45:15.528Z `generation.cancel` a3c8ed3d, and 1 ms later the robot's held submit resolved
  CANCELLED. ONE cancel, ONE clip: the cowboy video kept rendering. Chat step "Cancelling a generation",
  result "Cancelled, as you asked."
- As designed, and visible here: the queued message did NOT reach the agent mid-turn, so the robot was
  dispatched at 10:45:09Z and cancelled 6 s later rather than never sent.
