# MPI-1017 checklist

- [x] Panel open locks the operation: the prompt box publishes its op while pinned (`state.agentPinnedOp`); a different op from Cosmo is refused (OP_PINNED), an omitted op runs the panel's
- [x] Panel open locks the batch: an agent run takes the panel's saved batch; Cosmo's own batch is dropped and a `count` fan-out is refused while pinned (SETTINGS_PINNED)
- [x] Cosmo is told the panel's op and batch, and that it owns only the references and the prompt
- [x] A reference clip is priced by its recorded length (`agentCards.durationOf` via `/connector/quote`); a ceiling says "up to" on the spend card
- [x] A No on the spend card hands the quoted price back to Cosmo (`_declinedPriceNote`)
- [x] Tests: pinned op / batch / count, reference-clip pricing, declined price note, sidecar length
- [x] docs/agent-chat.md pinned table + docs/cloud-generation.md reference pricing updated
- [ ] Fabio's live re-ask: panel open on Wan 3.0 t2v 720p 4 s, "repeat this video" -> t2v, card says about $0.40
