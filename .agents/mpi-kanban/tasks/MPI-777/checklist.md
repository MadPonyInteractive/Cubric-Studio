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
- [x] **Get the 103 GIFs into version control.** All 103 copied to
      `MadPony-Identity/runs/2026-09-20-mpi-78-gif-cutouts/gifs/` and sha256-verified against the
      originals, which were not moved or rewritten. **Committed there but NOT PUSHED** — the push
      is Fabio's, see validation.md
- [x] **Settle the format: WebM.** Decided on measurement, not preference — as GIF the set is
      ~57 MB and costs ~305 MiB of VRAM for five mascots on the landing; as VP9 alpha it is
      13.7 MB and ~13 MiB, because alpha VP9 is software-decoded. The "missing exporter" that
      three places recorded as a blocker was one ffmpeg invocation
- [ ] **Settle the remaining placement points** (were MPI-78's, now this card's): Flows — Audio's
      only home; where the Prompt mascot appears; the empty-gallery spot. The 48px agent-chat
      mascot question is already answered by MPI-843, see plan.md open decision 4
- [ ] Open decisions settled with Fabio (hover interrupts, and the rest in plan.md)
- [x] Phase 1: cut-out clips staged under `assets/mascot/{key}/`, stills kept as fallback —
      95 clips, 13.7 MB, `scripts/stage-mascot-clips.mjs`, rim guard proven red (validation.md).
      The 8 not staged are the documented spares; they needed no labelling from Fabio
- [x] Phase 2: shared clip queue utility, with its unit test - `js/utils/mascotClipQueue.js`,
      8 tests, each guard proven RED on a broken rule (validation.md)
- [ ] Phase 3: landing hero crew on the queue (Fabio checks)
- [ ] Phase 4: prompt box ledge, agent mode and model modes (Fabio checks)
- [ ] Phase 5: the rest of the spot map in `docs/mascot-placement.md`, then Flows
