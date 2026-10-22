# MPI-1095 checklist

Fabio 2026-10-22: two stages, like FLUX.3. Stage 1 ships the 2.5 MODEL alone, dev-gated
(`devOnly: true`) until ready, for a quick release. Stage 2, only after that release: 2.5 in
the LTX Flows and the new 2.5-only Flows (tile upscaler etc., MPI-578).

## Research (stage 1 input)

- [x] 2.5 loads on the shipped engine (ComfyUI v0.42.1): core yes; custom-node pin predates 2.5 (test)
- [x] Weights: every file, size, licence / gate, quant tiers for the fast card
- [x] Op parity (on paper): t2v, i2v (start / end / both), ref2v (Ingredients), audio modes - bench pending
- [x] LoRA parity (on paper): Ingredients has a 2.5 build; merged LoRA's abliteration half cannot load on Gemma 4; rest to test
- [x] Every 2.5 capability and LoRA beyond 2.3 (input for stage 2)
- [x] Findings written to `research/findings.md` and summarised for Fabio

## Stage 1 (model alone, dev-gated)

- [ ] Plan from the research
- [ ] Bench tests on G: (2.3 vs 2.5, same prompts and seeds)
- [ ] `/mpi-add-model` wiring with `devOnly: true`
