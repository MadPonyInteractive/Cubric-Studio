# Source Manifest — FLUX.3 Klein

Provenance for the `flux-3` recipe (MPI-1181). **Vendor-skill sourced** (playbook 08): Black Forest
Labs publish the system prompts of their own prompt upsampler (PUP), Apache-2.0, so they ship
VERBATIM. No NotebookLM notebook exists for FLUX.3; not a blocker.

- **Model version researched:** FLUX.3 [klein] 5.6B (BFL, released 2026-10-15), the t2i + edit
  model Vision ships as `flux3-klein` (base + distilled int8-convrot, Qwen3-VL-4B encoder).
- **Research date:** 2026-10-19 (prompts copied), 2026-10-20 (Phase 0 sweep, external-VLM set).
- **Researcher:** agent (`gh api`, the MPI-1181 bench).

## Sources

| # | Title / URL | Authority tier | Accessed | Notes |
|---|---|---|---|---|
| 1 | github.com/black-forest-labs/flux-3-image-klein `src/flux3/pup_prompts.json` (+ `pup.py`) | official-docs | 2026-10-20 | The fine-tuned upsampler's four system prompts (`t2i`, `i2i`, `t2i_bbox`, `i2i_bbox`). Byte-identical to the card's `bfl_pup_system_prompts.json` (cmp). **`t2v` mode = its `t2i`, verbatim**: one generative-voice prose block, 100-350 words, medium convention first ("Full-color outdoor photograph, ..."), observable person profiles, frame-relative layout, verbatim quoted text, no mood sentence, optional `TARGET CANVAS: W:H` first line. |
| 2 | same repo, `src/flux3/pup_prompts_external_vlm.json` (commit 2026-10-17 "add the upsampler system prompts for external VLMs") + `README.md` § "An external vision-language model can also write the caption" | official-docs | 2026-10-20 | **The set BFL hand any model writing the caption in place of PUP: our case.** Same rules, expanded, with worked examples; `t2i` ~7,400 words, `i2i` ~1,000. **`i2i` mode = its `i2i`, verbatim, + one adapter sentence** (our enhancer reads a description of each reference, `withImageLooks`). Length scales: 1-2 sentences / 40-90 words / up to 150. **Rejected for t2i:** ~10k tokens, past Ollama's 8,192 context (`services/llmEngines.mjs`) and a 10k prefill per Enhance on the local 4B. Candidate for a DeepInfra-only t2i if Stage 2 finds the short one lacking. |
| 3 | same repo, `src/flux3/bbox.py` | official-docs | 2026-10-20 | Box payloads for the two `*_bbox` prompts (Boxes work, not this recipe yet). Copy: `tasks/MPI-1181/research/bfl_bbox.py`. |
| 4 | huggingface.co/black-forest-labs/flux-3-image-klein-pup | official-docs | 2026-10-19 | BFL: do not run Klein without an upsampler; a short prompt as typed renders flat. |
| 5 | `.agents/mpi-kanban/tasks/MPI-1181/brief.md` + `validation.md` (bench 2026-10-19) | in-house measurement | 2026-10-19 | Fabio: results "really bad" without the upsampler rules; a custom-size edit pillarboxes without a `TARGET CANVAS` line in the final prompt. |
| 6 | Community skills: `AI-KSK/flux3-klein-prompting` (2★), `kkget/Comfyui-Flux3-promt-Skill` (1★), `T8mars/Comfyui-Flux3-PE-GGUF-T8` (5★, a GGUF PUP runner) | community-skill | 2026-10-20 | Phase 0 step 2 (`gh api search/repositories`). All under a week old with single-digit stars; none adopted, the vendor's own prompts outrank them. |

## Conflicts

- The fine-tuned `i2i` (#1) says "Typical length is 50 to 150 words"; the external `i2i` (#2) scales
  down to 1-2 sentences for one property. #2 wins (our case): `wordBudget` 15-150.
