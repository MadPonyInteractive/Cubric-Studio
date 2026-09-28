# MPI-913 checklist

- [x] Red-first unit tests in `tests/agent-loop.test.cjs` (release, no second round, waiting line, typed message waits, no-ops for DeepInfra / -cloud / billed / Pod)
- [x] `services/agentLoop.mjs` + `engineIsLocal()` in `services/agentTools.mjs`
- [x] Full `npm test` (one peer-caused failure, see validation.md)
- [ ] Live check by Fabio on an Ollama agent
