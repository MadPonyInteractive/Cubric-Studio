# MPI-1012 checklist

- [x] P1 Colours — four overlays + tile flags/badges take image/video/audio family colours (code + test; Fabio's look pending)
- [x] P2 Audio as a model media type (typedefs, stores, pickers, Library, tiles)
- [x] P3 The swap in ONE commit (ops, controls, ModelDefs, workflows, licence re-key, graphics, Flows out, tombstones, aliases) + the P5 parts the suite needed (guides, named params, model voice slots)
- [x] P4 Prompt box voice picker + required-slot dimming + no Enhance (`+` reads "Add a voice" on tts and opens audio with library + mic; tts dims "needs a voice"; no `+` on Sound & Music; Enhance already off since P3)
- [x] P5 Agent / connector / MCP (voice card on a model op opens the prompt box; `app:operations` already renders t2a/tts info + help from the registry)
- [x] P6 Smoke runner counts audio for model ops (+ required audio slot gets `smoke-probe.wav`; folded in: install probe survives MPI-513 job pruning, merge keeps a new model unproven)
- [x] P7 Docs, skills, UNRELEASED roster, bench fixture (+ the Model drawer now links Stable Audio's Gemma terms); Docs-site + Website lines handed to Fabio (no Docs-site session live)
- [x] P8 Live check in an isolated app, then Fabio's look (all five steps passed 2026-10-03)
- [x] P9 Chatterbox Speed + Exaggeration sliders, both arms (1a6bc93d5; Fabio listened, accepted)
