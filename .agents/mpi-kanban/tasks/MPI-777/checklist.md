# MPI-777 Checklist

**Assets landed 2026-09-20.** MadPony-Identity MPI-78 is closed: every clip is rolled, reviewed,
hand-fixed, converted and cut out. Everything that was still open there moved onto this card,
because nothing mascot-related stays in that repo any more.

- [x] Unblocked: the GIF cut-out tooling produced the mascot assets — 103 finished GIFs, driven
      live on 2026-09-20. **Note: MPI-757's card still reads `todo`/`planned` though it shipped**,
      so this card's stated blocker looks unmet when it is not. Move that card or ignore it
- [ ] **Re-roll the three missing Studio clips**, or decide to ship without: Happy head pop
      (`i2v_015`), **Failed (`i2v_016`)**, landing no projects (`i2v_042`). Failed is the one that
      matters — every other mascot has one, Studio/Cosmo does not, so the agent-panel ledge cannot
      show a failed state. Rolling recipe and prompts: `docs/mascot-states.md`,
      `docs/mascot-scenarios.md`
- [ ] **Get the 103 GIFs into version control.** They exist only in
      `C:\Users\Fabio\Documents\Cubric Vision\Projects\Cubric Studio GIFs\Media\` — one folder, one
      machine, no second copy. Phase 1 stages them under `assets/mascot/{key}/`; until then the
      whole deliverable is unbacked
- [ ] **Settle the format:** the 103 GIFs as they are (1-bit alpha, fine on flat vector art with
      thick outlines), or build the VP9 alpha WebM export first. Phase 1 waits on this answer, not
      on the assets
- [ ] **Settle the remaining placement points** (were MPI-78's, now this card's): Flows — Audio's
      only home; where the Prompt mascot appears; the empty-gallery spot. The 48px agent-chat
      mascot question is already answered by MPI-843, see plan.md open decision 4
- [ ] Open decisions settled with Fabio (hover interrupts, and the rest in plan.md)
- [ ] Phase 1: cut-out clips staged under `assets/mascot/{key}/`, stills kept as fallback
- [ ] Phase 2: shared clip queue utility, with its unit test
- [ ] Phase 3: landing hero crew on the queue (Fabio checks)
- [ ] Phase 4: prompt box ledge, agent mode and model modes (Fabio checks)
- [ ] Phase 5: the rest of the spot map in `docs/mascot-placement.md`, then Flows
