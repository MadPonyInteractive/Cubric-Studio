# MPI-891 — checklist

Derived from plan.md (D1-D4 confirmed by Fabio 2026-09-22, plus the folded re-run miss).

- [x] Model rule: a RE-RUN task ("this image, but with model X") = text-to-image on X from the source's prompt, no media; harness case, `--bite`
- [x] `follow: true` on `generate` from a typed turn only (not wake, not carry); `routes/connector.js` passes it; a CLI agent never sends it
- [x] Canvas edit mode published to `state` by the `MpiCanvas` mode setter; one app-lifetime pointer-held tracker
- [x] The guard in `agentDispatch.js`: follow + target differs + no button held + no canvas edit tool + no Flow overlay; navigate BEFORE enqueue
- [x] D4: an edit of any card's entry routes to that card's history (not only the open card)
- [x] one honest-limits line (the `view` answer dropped: no early channel, see plan drift)
- [x] D3: the result card opens the gallery for a new card, the card's history for an edit that landed in it
- [x] Tests: the guard decision table, D4 routing, `npm test` 1821/0 (desktop spec dropped, see plan drift)
- [x] `docs/agent-chat.md` "Moving the view (MPI-891)"
