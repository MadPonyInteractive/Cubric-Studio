# MPI-1002 Checklist

Umbrella: MPI-1000 (phase 2). Derived from `plan.md`.

- [x] Step 1: js/services/flowEnhance.js shared primitive; MpiBaseFlow reuses it; hand run byte-identical (golden)
- [x] Step 2: agentFieldSpecs omits hidden fields; hidden caller values ignored; voices string round-trips
- [x] Step 3: in-graph enhancer guard in commandExecutor (local + Pod); stale docs fixed
- [x] Step 4: agent-seeded hidden blocks adopted as machine-written (one pass at Cue)
- [x] Step 5: Cosmo guidance for Song in docs/agent/flows.md; prompt budget test green
- [x] Step 6: buildFlow calls enhanceFlowRun (done after MPI-950 released it)
- [ ] Step 7: live matrix (ComfyUI / Ollama / DeepInfra picks; log names the backend)
