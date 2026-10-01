# MPI-1006 Brief

Seedance 2.0 Enhance gains a `ref2v` recipe mode that keeps the `@` reference tags.

Umbrella: MPI-985 (cloud models on DeepInfra). Follows MPI-910 (closed 2026-10-01), which shipped
Seedance `ref2v` and made the prompt box `@` picker write `@image1` / `@video1` / `@audio1`.

## Why

Fabio, 2026-10-01, picked this from three agent-side options. The recipe
`js/data/recipes/seedance-2.0.recipe.js` has modes `t2v` and `i2v` only. On a `ref2v` op Enhance
falls back to `t2v`, whose system text says "Do not use @Image, @Video or @Audio tags", so pressing
Enhance on a reference prompt can strip the very tags the user (or Cosmo) wrote.

## What is true today (read 2026-10-01, Agent 80)

- Modes: `t2v` (line 70) and `i2v` (line 195); `status: 'draft'`.
- Shared ban, line 50: `{ pattern: '@(Image|Video|Audio)\\s?\\d', ... }` is CASE-SENSITIVE, so the
  lowercase `@image1` the picker now writes slips past the check in both modes.
- Precedent for a reference mode: `js/data/recipes/minimax-h3.recipe.js` (`r2v`), op-to-mode wiring
  near `js/data/recipes/registry.js:108`; the mode pick itself is in `js/services/llmService.js`.
- Cosmo's guide `docs/agent/models/seedance-2.0.md` has three stale statements: line 5 ("the
  recipe has a mode for the first two only"), line 58 ("the prompt box's reference picker writes
  `<Image 1>`": it writes `@image1` for Seedance since MPI-910), line 122 ("no in-app render
  behind it": MPI-910 Phase 4 made one, $0.332, validation.md there).

## Source material (Fabio ranks it above our blog research)

`.agents/mpi-kanban/private/seedance-skills/` (gitignored, third-party: own words only, never
verbatim): `CINEDANCE HIGGSFIELD SKILL.md` (byte-identical to the copy Fabio re-sent 2026-10-01),
`prompt-builder-2-5.skill` (load-order `@image1` notation), `ACTING SKILL.md`, `LIRA SKILL.md`.

## Do not

- No paid Seedance video render without Fabio's yes, price and run count first (Fabio 2026-10-01:
  Seedance/Veo/Wan runs are expensive).
- Local Ollama for the recipe test loop: say so before it queues on his GPU.

## Noticed

- Future movie system (Fabio 2026-10-01, "plan for future releases"): ACTING SKILL's per-character
  master acting profile + one locked voice prompt, rewritten per scene. No card made.
- Wan 3.0 `ref2v` (`wan3-cloud`) enhances with `wan-2.2`, which has only a `t2v` mode, so Enhance
  may drop its `<Image 1>` tags the same way. Not this card's recipe.
- The shared `ref2v` op help (`commandRegistry.js` ~:780) shows `<Image 1>` examples, which on
  Seedance is the sound-effect mark; the help is shared with Wan 3.0.
