# MPI-1056 checklist

- [x] `js/data/childSafety.js` + `tests/child-safety.test.cjs`
- [x] `enqueueGeneration` gate (prompt box toast, agent CHILD_SAFETY error) + `tests/child-safety-gate.test.cjs`
- [x] Enhancer request + result checked, judge on the enhance backend
- [x] `flowEnhance` keeps the CHILD_SAFETY code, no Remote hint
- [x] `docs/child-safety.md` + docs map + `docs/llm.md` rule line
- [x] mpi-message to MPI-1053: Cosmo's content rule
- [ ] Cosmo's content rule lands (MPI-1053 holds `services/agentLoop.mjs`)
- [x] judge on a real model: DeepInfra gemma-4-26B, 20/20, $0.000385
- [~] live prompt-box toast: skipped, shared engine; real module driven in tests instead
