# MPI-890 — checklist

Derived from the card description and the five seams `pinned` already travels
(`js/services/agentService.js` → `routes/agent.js` → `agentSessions.send` → `runTurn` →
the opening lines).

- [x] `_workspaceForTurn()` in `js/services/agentService.js`, sent on both `/agent/message` and `/agent/wake` beside `pinned`
- [x] `routes/agent.js` accepts and validates `body.workspace` on both routes and threads it into the turn
- [x] `_sanitiseWorkspace` resolves the entry against the project and checks it with `agentCards.ownedMedia`
- [x] `services/agentSessions.mjs` passes it into `runTurn`; a CARRY deliberately drops it
- [x] `runTurn` takes `workspace` and registers the active entry in `_images` so `look`/`generate` resolve it
- [x] `_appStateLine` names the open card and which ref is its active entry
- [x] Cards rule: with a card open, "this image" is its active entry — no `list_cards`, no asking for an attachment
- [x] Tests in `tests/agent-loop.test.cjs`, three of the four halves proved red on their own
- [x] `npm test` 1791 pass / 0 fail, both lints exit 0
- [x] `docs/agent-chat.md` gets the seam, beside the `pinned` one
- [x] Fabio's live read — does it actually stop calling `list_cards` (live read 3 GREEN, 2026-09-22)
