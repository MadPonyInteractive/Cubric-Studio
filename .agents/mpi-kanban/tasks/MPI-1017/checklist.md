# MPI-1017 checklist

- [x] Panel open locks the operation: the prompt box publishes its op while pinned (`state.agentPinnedOp`); a different op from Cosmo is refused (OP_PINNED), an omitted op runs the panel's
- [x] Panel open locks the batch: an agent run takes the panel's saved batch; Cosmo's own batch is dropped and a `count` fan-out is refused while pinned (SETTINGS_PINNED)
- [x] Cosmo is told the panel's op and batch, and that it owns only the references and the prompt
- [x] A reference clip is priced by its recorded length (`agentCards.durationOf` via `/connector/quote`); a ceiling says "up to" on the spend card
- [x] A No on the spend card hands the quoted price back to Cosmo (`_declinedPriceNote`)
- [x] Tests: pinned op / batch / count, reference-clip pricing, declined price note, sidecar length
- [x] docs/agent-chat.md pinned table + docs/cloud-generation.md reference pricing updated
- [x] Fabio's live re-ask: panel open on Wan 3.0 t2v 720p 4 s, "repeat this video" -> t2v, card says about $0.40
- [x] REOPENED (Fabio's ref2v test, 2026-10-04: a 2 s clip got Shot 2 [3-6s]; Cosmo said 4:3 while the panel ran 1:1): the panel's duration and ratio reach Cosmo (`_pinnedForTurn` -> Settings panel line) and the generate result quotes the panel's values, never the agent's dropped ones
- [ ] Fabio's look after an app restart (server-side change): panel open on Wan 3.0, Cosmo names the panel's ratio and times shots inside the clip
