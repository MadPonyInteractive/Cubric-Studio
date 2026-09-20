# MPI-840 - checklist

- [x] `agentSessions`: a `_queued` list drained by `send()` after the carried turn; `busy()`
      counts it; `reset()` drops the queued turns of the conversation it clears.
- [x] The drain sits in a `finally`: a turn that threw would otherwise leave `busy()` true and
      hold every later message in a queue nothing drains.
- [x] `POST /agent/message`: while a turn is running, stage the attachments and queue the turn
      instead of answering BUSY. Reply `ok: true, queued: true`. `busy()` is read AFTER the staging
      awaits, with nothing async before the hand-off.
- [x] Test: a turn sent mid-answer runs after the current one, in order, and is not lost.
- [x] Folded in (found live the same round, same restart): the MODEL can no longer `write_memory`
      on `unfinished-generations.md` - `APP_OWNED_NOTE`. The ledger is the code's.
- [x] `cancel_generation` (found live 2026-09-20, Fabio: "The agent should be able to cancel
      generations"): the agent had 13 tools and none cancelled, so "Scratch that. Leave it." was
      read as "leave it running". `generate` sends its toolCallId as the submit's `requestId`;
      `POST /connector/cancel` relays `generation.cancel`; the renderer maps it to the Cue queue
      id and calls the queue's own cancel functions. Only what the conversation started itself.
      A clip cancelled this way leaves the unfinished ledger.
- [x] Live: type a second message while the agent is answering; it is answered next.
- [x] Live: ask for a clip, then a second one, then "scratch that" - the second is cancelled,
      the first keeps rendering, and the chat says so.
