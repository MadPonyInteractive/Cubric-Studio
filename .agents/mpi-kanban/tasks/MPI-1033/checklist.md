# MPI-1033 checklist

- [x] Bench test the anchor on the ref2va graph (3 runs, validation.md § Findings)
- [x] Speech-clip bench: today's graph, sounded speech video as <Video 1>, soundtrack kept? (Fabio: yes) - kept, 0.955/0.960 (run 4)
- [x] Correct agent text: commandRegistry ref2v_ms help, modelPriority REF_NOTE, docs/agent/models/minimax-h3.md (Fabio: yes; read MiniMax-H3 skills/ first)
- [x] Talking-portrait bench (run 5): still + voice line, lips follow it (Fabio: "really good")
- [ ] ~~Bench run: frames pinned, video soundtrack unwired from the reference~~ dropped with Phases 2-3
- [x] MpiH3References has no anchor option (checked 2026-10-06: only reference audio slots)
- [x] Product shape (Fabio's call): no pass-through, no toggles
- [ ] ~~Wire it~~ dropped (Fabio 2026-10-06)
