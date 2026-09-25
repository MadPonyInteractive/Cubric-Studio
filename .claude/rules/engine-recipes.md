# Engine & recipe rules

> **Ported from Cubric-Prompt** `.claude/rules/engine-recipes.md` (MPI-677 step 4, Fabio's yes
> 2026-09-14). The recipe layer, playbook, research and Stage 1 harness moved here in MPI-35 /
> MPI-677; this is the reasoning that travelled with them. Dropped as Prompt-only: Zod, its
> engine-readiness UI, its Ollama lifecycle, and the broker memory-release contract. Process:
> `docs/recipes/playbook/`. Procedure: the `create-enhancer-recipe` skill.

The Enhancer's two pillars are **data behind a registry**, not code: adding a target model or an
engine model is a file or an entry, never a new branch at a call site.

## Three decoupled axes — never conflate them

- **Engine** — *which LLM rewrites.* `services/llmEngines.mjs`: Ollama, ComfyUI, any
  OpenAI-compatible endpoint (`DeepInfraEngine`, the app's "Remote" connection), and
  `MODEL_REGISTRY` (a neutral `id` plus `ollamaName` and/or `deepInfraId`; in the app it is the
  Ollama catalogue, Remote models come from the connection). One implementation, two consumers:
  the app's route (`routes/llm.js`) and the Stage 1 harness (`scripts/recipe-test.mjs`). The
  user picks a backend per job in Language Models settings ([docs/llm.md](../../docs/llm.md)).
- **Recipe** — *which target model's syntax to rewrite toward.* `js/data/recipes/{id}.recipe.js`
  plus one line in `registry.js`.
- **Style / register** — *how directed the image is:* `cinematic` / `general` / `candid`,
  `js/data/recipes/styles.js`, default `general`.

They meet only where the system prompt is composed: `composeSystemPrompt()` (`styles.js`,
wrapped by `selectSystemPrompt()` in `registry.js`), called from `enhance()` in
`js/services/llmService.js`.

## Recipes do four jobs — expand, rearrange, condense, infer intent

Enhancement is not only "short idea → detailed prompt". Every `systemPrompt` must detect which
job the input needs and do it:

- **Expand** a sparse prompt with high-signal detail.
- **Condense** an overlong one to the model's format and budget — trim, never pad.
- **Rearrange** a disordered one into the model's element order, keeping every choice the user
  already made.
- **Infer intent** when the user gropes for a word — resolve it into the model's vocabulary.

A recipe that only expands pads an already-long prompt past its budget. `wordBudget` on every
mode is what makes the condense job checkable; `lengthNorm` is the human sentence beside it.

## `wordBudget.max` comes from the ENCODER, not the examples

Per mode, find out what encodes the prompt. **CLIP-class (77 tokens) → the budget is a real
limit. An LLM encoder → the ceiling is taste: set it from the vendor's stated target, or leave it
wide.** Never inherit a budget from demo prompts.

- `minimax-h3`: text path Qwen3-VL-32B, `model_max_length: 262144`. Its old `max: 230` came from
  three demo prompts, while MiniMax's reference mode asks 350–500 words for one section of six.
  With no wall to defend, the condenser cut the repetition that carried the descriptors, and
  Fabio's production wrote *"Do not run these prompts through Vision's enhancer."*
- `chroma`: no vendor guide, but the code answers — T5 `model_max_length: 512`. The recipe claimed
  a ~10,000-token window from a community doc, 20x wrong, harmless only until someone acted on it.

**"No wall" does not mean "no number", and the number is not the control** (`ltx-2.3`, ~200
runs). Deleting the stated number dropped a tier through its floor, so it is load-bearing; but
raising it 130 → 200 left the measured mean flat at ~133. What moved the distribution was
required SUBSTANCE per sentence ("two concrete specifics per sentence": minimum 97 → 118). State
a number; steer with the countable unit — sentences × specifics.

**When a bound keeps failing clean output, the bound is the defect** (playbook 07 §7.1 rung 3).
Measure both populations — the real defects and the clean runs — and put the number in the gap
between them, not two words from either edge.

## Register is cross-cutting, never a fifth job

All four jobs still run; only the words they resolve into invert. Process:
`docs/recipes/playbook/06-registers.md`.

- `structureOrder` is identical across styles. A style never says "skip lighting", and a shot
  type never goes in a banned list — the recipe requires every prompt to name one.
- Two halves, two homes: model-agnostic intent lives once in `styles.js`; the words a model
  responds to live on `ModeRecipe.styleVocabulary`. `avoidedTerms()` derives the banned set
  (opposing style minus own), so a shared term drops out with no authoring.
- `styleVocabulary` is optional, and a recipe without it is byte-identical. Proven on `krea-2`
  only — do not extend it until Fabio's Stage 2 confirms the shape survives into pixels.
- Author vocabulary from a measured, **split** corpus with **whole-word** matching — two guessed
  sets both measured ~zero against 209 real prompts. Never infer the register from the input; the
  caller picks.

## Adding a target model or an engine model = data, not code

- **Target recipe:** `{id}.recipe.js` + one line in `registry.js`. No Zod: `validateRecipe()` is
  asserted across the registry by `tests/recipe-registry.test.cjs`, so a malformed recipe fails
  `npm test`, not the import. Skip the tests and it ships broken.
- **Engine model:** an entry in `MODEL_REGISTRY` naming at least one backend. Coverage is
  asymmetric on purpose — abliterated builds exist only locally, frontier models only in the
  cloud — and asking for a backend the entry names no variant for is an error, not a guess.

## Enhancement is exempt per OPERATION, not per model

Locked by Fabio (2026-08-05). An edit takes an instruction ("remove the sign"), not a scene;
expanding it damages it. So those ops get **no enhancement at all** — the control is absent, not
disabled. `ENHANCE_EXEMPT_OPS` / `opAllowsEnhance()` in `js/data/commandRegistry.js`.

| Operation | Enhance? |
|---|---|
| `t2i`, `i2i`, `control` | yes — `control`'s reference fixes structure; the prompt still carries the creative load |
| `detail`, `upscale` | yes, but a different job: describe an image that already exists |
| `edit`, `kleinEdit`, `krea2Edit`, `qwenEdit`, `inpaint` | **no** |

Never derive it from the model: Klein spans both sides of the line on its own.

## Callers resolve by alias, and the fallback is pinned

`models.js` sends `enhanceRecipe ?? type`. `resolveRecipe()` matches the exact id, then
`RECIPE_ALIASES`; on a miss `resolveRecipeId()` (`llmService.js`) answers with
`FALLBACK_RECIPE_ID` and `fellBack: true`. The fallback is designed to answer, which is why it
hides a miss: two MiniMax-H3 **video** cards were enhanced by the `chroma` **image** recipe and
nothing failed. Surface `fellBack`.

- **"The recipe exists" is not "the caller reaches it."** `testResolutionAudit` reads `MODELS`
  directly and fails on any key that falls through, so a model added to `models.js` is audited
  with no test edit.
- Only alias a key a caller **deliberately chose** — never to silence a real mismatch.
- `enhanceRecipe` is never a blocker: it exists only to pick a recipe. Wrong recipe → change the
  key, model by model.
- The mode: `resolveMode(recipeId, asked)` — `t2v` unless the caller names a mode the recipe
  declares.

## The vendor's own prompting skill is step 0, before research

A recipe's `systemPrompt` *is* a prompting skill. Search the vendor's and the community's first —
`docs/recipes/playbook/08-vendor-prompt-skills.md` has the commands and the authority order.

- **List the tree; dotfolders count.** MiniMax's H3 skill is at
  `.claude/skills/h3-prompt-writing/` (no root `skills/`), and it went unread for four sessions.
- **Some models are written by their community.** Seedance's top skill carries 3,315★; a recipe
  that ignores that ecosystem is not under-researched, it is wrong.
- **"No guide exists" still owes you the encoder** — see `chroma` above.
- **A vendor rule can be right and not apply,** because it is scoped to a surface we do not use:
  Krea's moodboard is a hosted-API field, and local ComfyUI has none. Record the inversion
  condition.
- **A citation is only as good as its VERSION, and a version check ends at the SELECTION code,
  not the repo.** `Lightricks/LTX-Video` is the retired 0.9.x line; `Lightricks/LTX-2` serves two
  lines, and `base_encoder.py` picks `gemma3_*` (LTX-2.3) or `gemma4_*` (LTX-2.5) by encoder type.
  A survey merged `gemma4_*` into `ltx-2.3`, and the two disagree on colour, camera motion and
  length. A contradiction inside your own source manifest is the cheapest version check there is.
  A skill's frontmatter names its model version: read it before the body (a Seedance **2.5**
  builder sat beside the 2.0 skills in MPI-911, corroboration only).
- **A wrong-version read is step 0 for the model it actually describes** — file it there.
- **Rejection is part of the merge.** Wan's rewriter ends with rules that swap the user's subject;
  they are rejected, and written down where the next reader will hit them.

## Field evidence outranks a Stage 1 green, and is scoped to its MODE

Stage 1 measures the instrument — an enhancer, a judge and some regexes agreeing. It never sees a
pixel. When a real production contradicts a green recipe, **the render wins and the recipe
reopens.** Reasoning: `docs/recipes/playbook/09-field-evidence.md`; procedure: the skill's Phase 5.

- **The trigger is a card Fabio files** (2026-09-14), not a model version bump.
- **Scope every claim to the mode that produced it.** Fabio's ~100-clip western is `r2v` only:
  first-class evidence for `minimax-h3` r2v and zero for its t2v/i2v, which share the file and its
  rule consts. A finding from a neighbouring mode is a hypothesis, never a result — and a vendor
  guide for base modes says nothing about reference mode, or the reverse.
- **Budget the re-sweep first.** Every edit resets twice-green: three modes owe six clean sweeps
  plus the iteration, ~7 minutes each. Land the knowledge in the card and docs before the edit; a
  merge reported done with unfinished sweeps is an unverified recipe reported as proven.

## Recipe lifecycle — `draft → validated` is human-only

- **Stage 1 is text-only and the agent's, run to completion without asking:**
  `npm run recipe:test -- <id> --engine <model> --judge gemma-3-12b --runs 3`. The judge always
  runs on Ollama, whatever `--backend` says. **Twice-green counts only on the enhancer of record**
  (`gemma-4-abliterated-12b`, `services/llmEngines.mjs`); a smaller rung is a wording probe first,
  never the count. **Green means the full sweep passed TWICE** — a
  129/129/127 green re-ran as 1/3. A 4B judge fabricates violations. **Never pipe the harness
  through `tee`**: the pipeline reports tee's exit code, so a failing sweep reads as exit 0. A
  local sweep holds the GPU — run it under the lease (`.agents/mpi-kanban/project-knowledge-index.md`
  § The GPU lease).
- **When a constraint will not hold, reframe the operation — do not strengthen the constraint.**
  Three measured forms: a numeric cap (attack the operation, then the unit, only then the number);
  a growing ban list (banning `balanced` produced `centered` — give the model the sentence to
  write instead); a prohibition illustrated with the sentence it prohibits (the example seeded the
  failure verbatim). Every judge lens needs its carve-out written in.
- **An objective breach belongs in `forbiddenPatterns`, not `donts`.** `dos`/`donts` reach only
  the judge: `pony` passed every sweep at judge 2/2/2 while emitting placeholders, a leaked quality
  word and an emoji. `forbiddenPatterns` (`{pattern, why}`) fails the run deterministically, and
  recipes that went green before it existed met a lower bar.
- **`dos`/`donts` are the grading contract, so they move with the notation, in every mode.** The
  H3 notation rewrite updated i2v's and r2v's lists and missed t2v's: its `general` tier scored
  `format=1` on 9 of 9 runs and still passed two sweeps before tipping. A stale line fails no
  check and reads clean in review.
- **Stage 2 is the render, and it is Fabio's**, only on a recipe already green twice. Recipes ship
  `draft` (`testDraftStaysHumanOnly`). An agent may run every check and report; it **never** sets
  `validated` and **never** renders.
- The test enhancer is **uncensored, smallest-first** — a safety-tuned model sanitises instead of
  shaping. The ladder: `docs/recipes/playbook/05-model-ladder.md`.

## Honest state

Every completion reports the backend and model that actually answered, and the UI shows it
(`docs/agent/prompt-enhancement.md` § Backends). Never imply local when the cloud ran.

## Sub-Agent Briefing

You are working on an enhancer recipe or an LLM engine. Both are data behind a registry, never a
branch at a call site.

- **Three axes, never conflated:** engine (`services/llmEngines.mjs`), recipe
  (`js/data/recipes/{id}.recipe.js` + one `registry.js` line), style (`styles.js`).
- **Every recipe does four jobs** — expand, rearrange, condense, infer intent — and every mode
  sets a `wordBudget` whose max comes from the ENCODER, never from demo prompts.
- **NEVER set `status: 'validated'` and NEVER render.** Both are Fabio's, after a Stage 2 render.
- **Stage 1 is yours:** `npm run recipe:test -- <id> --engine <model> --judge gemma-3-12b --runs 3`.
  Green = the full sweep passed TWICE. Never pipe it through `tee`. Local sweeps run under the
  GPU lease.
- **A constraint that will not hold: reframe the operation, do not strengthen the constraint.**
- **Objective breaches go in `forbiddenPatterns`; `dos`/`donts` reach only the judge** and are the
  grading contract — change them with the notation, in every mode.
- **Field evidence outranks a green and is scoped to the mode that shot it.** A heal starts from a
  card Fabio files (skill Phase 5).
- **Edit and inpaint ops get no enhancement** — the exemption is per operation
  (`ENHANCE_EXEMPT_OPS`).
- `npm test` validates every recipe (`validateRecipe()`, `testResolutionAudit`). Report a failing
  sweep as failed, with the tier and the run counts.
