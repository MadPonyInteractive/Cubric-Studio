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

**2026-10-09 (session cd9258be): stated-details fix APPLIED to the recipe, proven on DeepInfra gemma-3.** Parked patch
applied and tightened: rule 1 = THE BRIEF IS FIXED, opening sentence carries every stated detail (incl. what the subject
holds; example in the rule is NOT the knees case, so the A/B is not rigged), never invent brands, a closing self-check,
"sections are not paragraphs". Found and fixed on the way: gemma-3 appended the RGBA alpha sentence to 13/16 ordinary
prompts (transparency now gated on the user's own words; 0/16 after, sticker still 8/8). Evidence `validation.md` +
`deepinfra-ab.txt`. ~1.2 cents spent of a 2-cent cap. NEXT: Stage 1 twice (harness, gemma-4 + gemma-3 judge, running
under the lease from this session), then commit. Open idea, not done: a harness tier for "short prompt with a hard
detail" + a transparency tier (shared TIERS = every recipe; Fabio's call).

Previous: **2026-10-09 (session 3e2b8b66), REOPENED by a field failure.** Stage 1 is green (sweeps 3+4) and committed in
ea0b707ef, but Fabio's own Enhance on RunPod (project "Qwen 2.1", cards t2i_011/t2i_012, source prompt "A woman in a
monokini on a beach with water up to her knees") came back 385 words with her on DRY SAND, two paragraphs, two
closing sentences, lighting after the close, and "a subtle drop shadow". His app's enhancer is DeepInfra (stored
endpoint model `google/gemma-3-12b-it`), not the harness's gemma-4 12B.
Root cause (recipe): rule 1 locks only the SUBJECT; the Sparse branch says "decide everything the user left open" and
nothing protects the other details he stated. "drop shadow" is in the system prompt's welcome-terms list unqualified.
Candidate fix: `keep-stated-details.patch` (rule 1 -> THE BRIEF IS FIXED, every stated detail in the first three
sentences; Sparse fills only the gaps; drop shadow on a poster/sticker only). A/B on his exact input, 5 runs each
(`knees-ab.txt`, harness engine path): gemma-4 12B kept the knees 4/5 -> 5/5; gemma-3 12B 3/5 -> 1/5 (its opening still
says "on a tropical beach"; the contradiction regex may over-count "feet in the sand" under water - read the outputs).
NOT applied: the recipe file is back at ea0b707ef.
NEXT: (1) read the gemma-3 runs, tighten the patch (likely: make the stated details the opening sentence itself, and a
self-check line); (2) test on DeepInfra `google/gemma-3-12b-it` = what the app runs (costs cents, say the price first);
(3) a harness case for "short prompt carrying a hard detail" (shared TIERS affect every recipe: Fabio's call, or a
recipe-local check); (4) apply, re-run Stage 1 twice, commit. The 2-paragraph / double-closing slip is gemma-3's;
check it in the same DeepInfra run.

Previous:

Phases 1, 2, 4, 5, 6 done (2026-10-09): research + sources, recipe `js/data/recipes/qwen-image-2.1.recipe.js`
registered (registry test count 13 -> 14), guide `docs/agent/models/qwen-image-2.1.md`, flux-2.md trimmed to a
pointer, models.js `enhanceRecipe: 'qwen-image-2.1'`, read-back shows `guide:qwen-image-2.1`, agent tests green.
**2026-10-09 (session 3e2b8b66): Phase 3 DONE.** Two recipe fixes (per-section sentence counts + limb rule from MPI-936's
renders; stated length 350), then sweeps 3+4 both 15/15 ALL PASS: `docs/recipes/research/qwen-image-2.1/validation.md`.
NEXT: Phase 7 (Stage 2 renders, Fabio). Old note: Phase 3 was blocked on the GPU: Ollama is quit, and Fabio's app engine (:48188, pid of
engine/ComfyUI_windows_portable python) holds 13.2 GB idle on the 16 GB 4060 Ti; a 12B beside a full card
bluescreened the box once (global memory tools/mpi-kanban.md 2026-10-04). Asked Fabio to free it or allow it.
Run: `gpu_lease.py run --timeout 7200 -- "C:/Program Files/Git/bin/bash.exe" <script>` where the script starts
`ollama serve` (OLLAMA_MODELS=H:\OllamaModels), runs `node scripts/recipe-test.mjs qwen-image-2.1 --engine
gemma-4-abliterated-12b --judge gemma-3-12b --runs 3` to a log (no tee), then kills the serve it started.

## Completed

- Phase 1 research, Phase 2 draft + registry, Phase 4 guide + flux-2 trim, Phase 5 models.js, Phase 6 read-back + tests.

## Remaining Work

Phase 7 (Stage 2 renders, Fabio).

## Plan Drift

- 2026-10-09: `overlong` is a 410-word brief (playbook says ~230) and `condensed` needs a shorter output, so the vendor's
  400-500 words cannot pass; draft holds 250-350 stated / 200-400 checked (research.md section 1).
- 2026-10-09: the Prompt Box @ picker writes `<Image 1>` for this model while the encoder labels refs `<image1>`; noted in brief.md.
