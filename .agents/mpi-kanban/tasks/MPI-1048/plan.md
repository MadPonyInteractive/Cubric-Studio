# MPI-1048 - Qwen-Image 2.1 prompting guide (MCP, Cosmo, Enhance)

## Goal

Qwen-Image 2.1 (MPI-936) borrows `enhanceRecipe: 'flux'` -> `flux-2` (Klein, 35-120 words), so
MCP `read_knowledge`, Cosmo and Enhance all get Klein's guide. Give it its own recipe + guide.

## Sources (found 2026-10-09)

- Official `QwenLM/Qwen-Image-2.1` `prompt_rewrite/prompts/system_prompt_{t2i,edit}.txt`: system
  prompts of two SEPARATE rewriter models (PE-T2I / PE-I2I, Qwen3.5-VL 9B fine-tunes, ~20 GB).
  NOT part of the encoder: ComfyUI's encoder turn is one line, "Comprehend and analyze the
  provided prompt." (`comfy/text_encoders/qwen_image21.py`). They spec the prompt 2.1 was
  trained on: t2i = one English observational paragraph, ~20 sentences, 400-500 words.
- The encoder labels refs `<image1>`, `<image2>` before the prompt text; PE-I2I mandates `<image1>`
  tags for 2+ images. Official RGBA wording: "This is an RGBA image with transparency. ... The
  image has alpha channel and the background is transparent."
- `kjranyone/qwen-image-2.1-prompt-guide` (MIT, 5 stars): restates the two official prompts +
  older-version community notes. Secondary source only.

## Shape

- Enhance never runs on edit ops (`ENHANCE_EXEMPT_OPS`), so the recipe has ONE mode, `t2v`
  (= t2i/i2i/control/detail/upscale text), built on PE-T2I. PE-I2I rules go into the GUIDE only
  (Cosmo/MCP write edit prompts themselves and can look at the image).
- Paraphrase the official prompts, never copy (repo licence "Other").

## Phases

1. Research: `docs/recipes/research/qwen-image-2.1/sources.md` + `research.md`.
2. Draft `js/data/recipes/qwen-image-2.1.recipe.js`, register in `registry.js`; `npm test` slice.
3. Stage 1: `npm run recipe:test -- qwen-image-2.1 --engine gemma-4-abliterated-12b --judge gemma-3-12b --runs 3`
   under `gpu_lease.py run --timeout 7200`, twice green; `validation.md` in the research folder.
4. Guide `docs/agent/models/qwen-image-2.1.md`; trim Qwen 2.1 out of `flux-2.md`.
5. `models.js` `qwen-image-2-1` `enhanceRecipe: 'qwen-image-2.1'`.
6. Playbook 07 § 5: read-back + `node --test tests/agent-corpus.test.cjs tests/model-priority.test.cjs tests/agent-prompt-budget.test.cjs`.
7. Hand over: Stage 2 renders (`<image1>` vs "image 1", long vs short prompt) are Fabio's.

## Verification

**Verify mode:** auto

Stage 1 twice green; recipe validates as `draft`; read-back shows `guide:qwen-image-2.1`; three agent tests pass.

## Current State

Phases 1, 2, 4, 5, 6 done (2026-10-09): research + sources, recipe `js/data/recipes/qwen-image-2.1.recipe.js`
registered (registry test count 13 -> 14), guide `docs/agent/models/qwen-image-2.1.md`, flux-2.md trimmed to a
pointer, models.js `enhanceRecipe: 'qwen-image-2.1'`, read-back shows `guide:qwen-image-2.1`, agent tests green.
NEXT: Phase 3 Stage 1 sweeps. Blocked on the GPU: Ollama is quit, and Fabio's app engine (:48188, pid of
engine/ComfyUI_windows_portable python) holds 13.2 GB idle on the 16 GB 4060 Ti; a 12B beside a full card
bluescreened the box once (global memory tools/mpi-kanban.md 2026-10-04). Asked Fabio to free it or allow it.
Run: `gpu_lease.py run --timeout 7200 -- "C:/Program Files/Git/bin/bash.exe" <script>` where the script starts
`ollama serve` (OLLAMA_MODELS=H:\OllamaModels), runs `node scripts/recipe-test.mjs qwen-image-2.1 --engine
gemma-4-abliterated-12b --judge gemma-3-12b --runs 3` to a log (no tee), then kills the serve it started.

## Completed

- Phase 1 research, Phase 2 draft + registry, Phase 4 guide + flux-2 trim, Phase 5 models.js, Phase 6 read-back + tests.

## Remaining Work

Phase 3 (two green sweeps, research validation.md), Phase 7 (Stage 2 renders, Fabio).

## Plan Drift

- 2026-10-09: `overlong` is a 410-word brief (playbook says ~230) and `condensed` needs a shorter output, so the vendor's
  400-500 words cannot pass; draft holds 250-350 stated / 200-400 checked (research.md section 1).
- 2026-10-09: the Prompt Box @ picker writes `<Image 1>` for this model while the encoder labels refs `<image1>`; noted in brief.md.
