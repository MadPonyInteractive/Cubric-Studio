# MPI-817 Checklist

An umbrella's checklist tracks PHASES, not the members' own items. Each member card keeps its own
checklist; this one closes when all three phases do.

- [ ] **Phase A — MPI-816: flow-field dispatch.** Both fixes, the confirm step, the skill doc
      update, the shared-primitive sweep. **Closes on:** four character sheets asked for in
      Fabio's own words, four cards land.
- [ ] **Phase B — MPI-774 Phase 6: global memory.** Design conversation with Fabio first; the
      footprint is unknown until it happens.
- [ ] **Phase C — MPI-774 Phase 7: agent reliability.** Includes the decision on the narration
      bug (the agent reported four sheets as started after four dispatches had already failed).
      - [x] The narration bug (2026-09-19, a2b243de): `generate` races the dispatch against
            `EARLY_REFUSAL_MS` and hands a refusal back in-turn, so a route refusal can no longer
            be narrated as "your image is on its way".
      - [x] **The pinned settings panel** (2026-09-19, session 35aabda4): built whole, both traps
            included. Code-verified — 1398 unit tests, lint clean, agent-chat.spec 28/28 whole-file.
            Evidence: `tasks/MPI-774/validation.md` § Phase 7.
      - [ ] **Fabio's own pass in the app** (Phase 7 is `user-ux`) — the five steps in that
            validation section. Needs a full app RESTART, not a reload.
      - [ ] The NSFW flag on `RECOMMENDED_REMOTE_MODELS` (Qwen3-VL-30B-A3B-Instruct only; the
            wording can only ever be "did not refuse in our tests", dated). Rides with the picker
            work.
      - [ ] The Ollama picker, plus the six free Ollama cloud models. Shape to be agreed with him.
- [x] **Fabio's call (2026-09-19): the member cards STAY separate** — on the condition that they
      get picked up later or ride as phases of this umbrella. Neither is allowed to go quiet. Do
      not fold, close or merge them without asking him again.

Done already, on MPI-774 and recorded there, not here: Phases 1-5, including fix 8 closed
unreproduced on 2026-09-19 (`tasks/MPI-774/plan.md` § Fix 8 closure).
