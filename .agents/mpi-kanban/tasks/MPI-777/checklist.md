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
- [ ] **Get the 103 GIFs backed up — STILL OPEN, and git is not the answer.** Tried 2026-09-21:
      all 103 copied into `MadPony-Identity` and committed, 303 MB. Fabio rejected it, the commit
      was reverted and the copies deleted. The 317 MB is genuine (AI-rendered frames, not a bad
      export — see `docs/mascot-gif-manifest.md`), and the GIFs are a middle step regardless: the
      masters are `Cubric Studio Mascots`, 2.8 GB on one machine. Needs an off-repo answer, and
      probably its own card aimed at the 2.8 GB rather than these 317 MB
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
- [x] Phase 3: landing hero crew on the queue — **Fabio saw it 2026-09-22: "the animations look
      good, and they are well connected."** Hover then lost its transition (queue gained a
      per-request `transition` flag, new test proven red first). Three follow-ups became
      Phase 3b below.
- [x] Phase 3b BUILT 2026-09-22, Fabio's look outstanding. The 15 transitions are re-encoded
      with an alpha plane keyed from their own black (`a = max(r,g,b)` in
      `scripts/stage-mascot-clips.mjs`, guarded by a new `--verify` branch proven red on an
      unkeyed clip) and `.mpi-landing__crew-fx` carries no blend at all: measured 43.7% →
      **0.0%** near-black over the mascot, same pixels. Crew labels are Lingo, Prism, Cosmo,
      Reel, Vinyl. The landing agent slot lost the 48px still and "Ask me anything" for Cosmo
      peeking over the block's top rule with the composer on the line.
- [x] Phase 3b, folded in (Fabio, 2026-09-22): "some animations are cut off before they
      finish". MEASURED, and it is not a length bug — every clip that is allowed to finish
      plays to its end (idle 5.2/5.2, 4.1/4.1, greet 3.0/3.0, happy 3.0/3.0, overlay
      0.89/0.9). The only cuts are the two deliberate interrupts, and Fabio's call on the
      naked one: "it's fine if it just cuts into the greeting animation right away. No
      worries. Just no transition." No code changed for it.
- [x] Phase 3 detail, for the record — BUILT 2026-09-22.
      `heroCrew.js` paints two stacked `<video>` per member plus a screen-blended transition
      layer; `_poseSrc` is gone. Self-checks in validation.md: 1779/0 tests, eslint clean,
      real Electron (own profile + port 57327) showing all five on their clips, a click
      playing its transition and swapping under it, a hover cutting straight to the greet,
      0 `play()` calls in 8s after navigating away, and reduced motion holding frame 0 with
      0 `play()` calls in 9s
- [ ] Phase 4: prompt box ledge, agent mode and model modes (Fabio checks)
  - [x] 4A: the agent PANEL's crew ledge (agent mode moved here by MPI-843) - built 2026-09-22; reworked same day to full figures, feet on the rule, on the clip queue - Fabio's look outstanding
  - [ ] 4B: the prompt box ledge, model modes - `MpiPromptBox` claimed by da9175f5 (stale heartbeat)
- [ ] Phase 5: the rest of the spot map in `docs/mascot-placement.md`, then Flows
