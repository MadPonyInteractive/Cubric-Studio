# MPI-774 Checklist

Derived from `plan.md` phases (2026-09-15).

- [x] Decisions, contract, describer question
- [x] Batch 1: four foundations
- [x] Integration and scripted harness
- [x] Fabio's round: no deletes, skills for the agent, panel layout, rules, project memory
- [x] Fabio round 2: one conversation per project, landing agent creates/opens projects (Phase 3c)
- [x] The agent box: input hint, numbered image chips, resizable full-height panel (Phase 3d, from MPI-797) *(Fabio passed items 1-4, 6, 7 in his app, the Studio head on 2026-09-17; item 5 deferred until the mascot animations)*
- [x] Live on the GPU *(2026-09-17: generations, boxes, install, enhance VRAM, compaction, honest limits; `validation.md` § Phase 4 and § Phase 4 close)*
- [ ] Fabio's pass
  - [x] Round 1 fixes 2-7: box share guard, memory rule, Studio cream, Language Models loading state, Stop in Agent mode, video/failed result card *(2026-09-18, `validation.md` § Phase 5 fixes)*
  - [x] Fix 1: ranked model priority per task, with a note where a rank cannot say it *(2026-09-18, Fabio's order)*
  - [x] Round 2, the agent-verifiable half: fixes 3, 4, 6, 7 driven in a live `app:isolated`
    instance — real DOM, computed styles, and a real generation cancelled by Stop
    *(2026-09-18, `validation.md` § Fixes 3, 4, 6, 7 proven in a live app)*
  - [x] Round 2, Fabio's half *(2026-09-18: cream YES and provably the mascot's token, spinner
    fine, gallery panel fine; two UI notes built as fixes 9 and 10)*
  - [ ] Fix 8: Stop poisons the next generation of a streamed model — WHERE the fix goes is
    Fabio's decision (`plan.md` § Phase 5 fix 8)
- [ ] Phase 6: global memory (Fabio, 2026-09-18) — next session
