# MPI-1006 Plan - Seedance 2.0 Enhance: a ref2v mode

Brief: `brief.md`. Umbrella MPI-985. Run with `/create-enhancer-recipe` ("revise the seedance-2.0
recipe"): it owns the research -> draft -> test loop and the evidence folder
(`docs/recipes/research/seedance-2.0/`).

## Current State

- 2026-10-01 (Agent 80): card made, nothing built. Fabio re-sent the CINEDANCE skill; it is the
  same file already in `private/seedance-skills/`. **Next action:** `todo -> doing`, then Phase 1.

## What the Higgsfield skills already settle (CINEDANCE unless noted)

- Keep every active `@` tag exactly as given; never invent one, never carry a stale one; every
  tag in the prompt names a reference that is visible or required in THIS shot.
- One anchor line per referenced subject: "@tag: age + role/body + current state + critical
  visible anchors + action prop. 100% matches the reference." The reference is the truth for
  face, body and costume; prose must not overwrite it.
- A location reference gives geography, materials, atmosphere, landmarks (and light direction),
  never the framing.
- Leave out what the UI controls: duration, ratio, R2V/T2V, resolution, fps, seed.
- Lens as diagonal field of view in degrees and visible outcome, never mm / f-stop / brand
  (the current modes already ban mm).
- Negatives local and short ("no flat front light"), never a block.
- Load-order notation `@image1` / `@video1` / `@audio1` per type: prompt-builder-2-5 (adopted by
  MPI-910). CINEDANCE says nothing about what a video or audio reference DOES; Cosmo's guide
  § ref2v (from prompt-builder-2-5) is the source for "moves like @video1", "in the voice of @audio1".
- ACTING SKILL (Fabio re-sent 2026-10-01, same file): two rules fit this mode - a character's
  acting line LEADS with its `@` tag, and write states ("mid-throw, arm extended"), not
  transitions. Its master-profile / locked-voice system is the future movie system, not this card.

## Open questions (answer from code before writing)

1. How Enhance picks a mode per op, and how H3's `r2v` is wired (`llmService.js`,
   `registry.js:108`, `minimax-h3.recipe.js`). MPI-1002 owned `llmService.js`; it is done now.
2. Does Enhance know which references are staged (count per type)? If not, the mode keeps the
   user's tags verbatim and adds none; if yes, it may anchor each staged one.
3. Shape: the existing modes write ONE paragraph (~150 / ~100 words). CINEDANCE writes labelled
   sections. Pick one with evidence from the test loop, not taste; anchor lines first either way.

## Phases

1. Read + design: answer the three questions, write the mode outline into this plan. No spend.
2. Build: `ref2v` mode in `seedance-2.0.recipe.js`; the shared `@` ban made case-insensitive and
   kept OUT of the ref2v mode; registry/tests updated. **Verify:** recipe tests + `npm test` green.
3. Test loop (skill): local Ollama first, free (one line to Fabio before it uses his GPU);
   DeepInfra LLM only with the price stated. **Verify:** text checks pass; tags survive verbatim.
4. Cosmo's guide: fix lines 5, 58, 122 of `docs/agent/models/seedance-2.0.md` (keep <= 200 lines).
5. No paid Seedance render unless Fabio asks (price + run count first).

## Verification

**Verify mode:** auto for the recipe checks and tests; Fabio reads two Enhanced ref2v prompts
before close (user-ux, prompt quality).
