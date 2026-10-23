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

- [x] Bench tests on G: (2.3 vs 2.5, same prompts and seeds) - 2026-10-22, 8 cases; Fabio: 2.5 WINS on acting
- [x] Gemma 4 file choice (one file for both 2.5 cards) + abliteration option - Fabio 2026-10-22: official int8; heretic benched (25h) and dropped
- [x] Tier bench DONE 2026-10-22 (i2v_start / i2v_both / i2v_audio_in): Fabio DEPRECATES 2.3 High. Was: once 2.5's setup is final: finished 2.5 vs 2.3 Balanced (int8,
      `ltx_i2v_t2v_int8.json`) vs 2.3 High (bf16, `ltx_i2v_t2v.json`; Fabio installs it in the app ->
      M:/CubricModels). LAST step of the comparisons; High never joins any other test (too slow).
      A couple of image-to-video cases only. Batch by model: all 2.3 Balanced, all 2.3 High, all 2.5.
      Answers: keep or deprecate 2.3 High. No 2.5 High in it; Fabio decides what follows from the result.
- [x] Plan from the research
- [x] `/mpi-add-model` wiring with `devOnly: true`
- [x] In-app GPU check, every op + preview -> Finish + bar count + preview decoder (2026-10-22, `validation.md`)
- [x] Stage 2 split out 2026-10-24 to MPI-1266 (Fabio: workable now; the dev gate comes off in 2.1.4)
