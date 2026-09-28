# MPI-941 checklist

- [x] A big batch is ONE job to the agent: one progress line, one report, no looks (live 2026-09-27: a 3-card KleinEdit set, one line, no looks)
- [x] MPI-948: a dragged gallery selection reaches the agent as ONE set chip (verified by Fabio 2026-09-27)
- [x] MPI-904: enlarge, remove background, crop with no model (+ downscale to a megapixel count, Fabio 2026-09-27) (verified by Fabio 2026-09-27)
- [x] `look` sees videos and GIFs (verified by Fabio 2026-09-27)
- [x] MPI-913: release local Ollama before the agent's own local generation (verified by Fabio 2026-09-28, Ollama server.log; duplicate waiting line fixed after)
- [x] MPI-905: 64K context floor (verified by Fabio 2026-09-27)
- [ ] Clickable options: the agent's choices as buttons, not typed answers
- [x] The spend line counts image analysis and prompt work as ONE "Agent" figure: "Agent · Generations" (verified by Fabio 2026-09-28: "Agent $0.006 · Generations $0.0005")
- [x] Phase 9: the agent cleans up after itself (cancel a replaced run, model strengths in the index, crop takes a plain ratio)
- [x] MPI-955 (Phase 10): History's prompt box survives a text-to-image model being selected
- [x] Phase 11: the Ollama agent picker lists tested local models with scores, hides tool-less ones, shows the real pick (verified by Fabio 2026-09-28: "1")
- [ ] Phase 12: "Benchmark this model" in Settings > Remote runs the agent suite on the user's pick
- [ ] Phase 13: the loop stops a repeated identical tool call (gemma4:12b sent one refused write_memory 15 times)
