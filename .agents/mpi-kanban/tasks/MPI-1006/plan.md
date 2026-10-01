# MPI-1006 Plan - Seedance 2.0 Enhance: a ref2v mode

Brief: `brief.md`. Umbrella MPI-985. Run with `/create-enhancer-recipe` ("revise the seedance-2.0
recipe"): it owns the research -> draft -> test loop and the evidence folder
(`docs/recipes/research/seedance-2.0/`).

## Current State

- 2026-10-01 (Agent 80): card made, nothing built. Fabio re-sent the CINEDANCE skill; it is the
  same file already in `private/seedance-skills/`.
- 2026-10-01 (Agent 81): card `doing`. Phase 1 done (answers + design below, no spend).
- 2026-10-01 (Agent 81): Phase 2 built on Fabio's go ("wire all four modes"): `recipeModeForOp`
  + `operation` through dialog and prompt box; `r2v` mode (draft A, anchor lines); harness tag
  check + `--ref-tiers`. Every example passes the deterministic checks; the tag check catches a
  dropped, re-cased and invented tag; `npm test` 2602/2605 pass, the one failure is MPI-1005's
  `agentReview` (master red on 2eb6bea46, messaged 28809bcb, theirs to land).
  **Next action:** Phase 3 sweeps (r2v plain + `--ref-tiers`, then t2v/i2v confirm).
- Sweep s1 (gemma-4-abliterated-12b / judge gemma-3-12b, 3 runs): ref tiers 10/12 (overlong 225
  words: walked the input clause by clause, kept armour/hair looks, two lenses, invented a line;
  judge passed it); plain tiers 0/15, every run INVENTED `@image1`... on tag-less input. Fixes:
  rule 1 names the no-tag case with a worked "cat -> A cat" line; t2v's condense wording ported;
  a voice tag with no user line gets no braces.
- Sweep s2: ref tiers 11/12 (one `35mm` leak); plain tiers 2/15, still inventing `@image1` (even
  "The cowboy from @image1" on a tag-less input). The mode's framing ("the user names them with
  @ tags") is the prior. Fix: framing says tags MAY appear and the text is the only list; two
  named output shapes picked by one test (is there an @?), H3's two-shape pattern; t2v's
  "no 35mm" ban ported.
- Sweep s3: plain 12/15 (3 invent `@image1`, all on inputs naming a person), ref 10/12 (201
  words; "35mm anamorphic lens" beside the degrees). Fix: a person named in words stays in words;
  condense aims 100; a lens type stays a look, never a number.
- Sweep s4: plain 12/15 (bare/medium/overlong/general 3/3; directed 0/3, the garbled input
  always cites "the cowboy from @image1"); ref 11/12 (overlong 233 words once). Tag-less
  invention went 15 -> 13 -> 3 -> 3 across four passes and has stopped moving. **Escalated to
  Fabio** (options in the session report). t2v/i2v confirm sweeps running meanwhile.
  Pending regardless: the r2v budget ceiling (200 was a guess; t2v's measured 240 covers the
  vendor's 234-word example).
- **Fabio 2026-10-01 picked (a)**: "I would never try a prompt for myself on a video model... I'm
  always going to go to the in-app agent" (Enhance is secondary for video; memory saved). Built:
  `withReferences` (registry.js) appends "Attached references, in load order: @image1, ..." on
  an r2v run only; prompt box passes `_stagedRefTags` handles -> dialog -> `enhance`; r2v cites
  every real tag (attached or written) once, never another; jobs for untagged attached refs
  from the user's words (one picture = the main subject; several in naming order). Budget 240.
  `--ref-tiers` now = 2 untagged + 2 tagged inputs with the attached line. Unit tests green.
- 2026-10-01 (Agent 81), **card `validating`.** Stage 1: staged-refs path 24/24 (s5 + s6), t2v
  and i2v 15/15, H3 r2v 15/15 with the line; nothing-staged edge 9/15 even with a "none" line
  (recorded limitation, not chased: Fabio rules Enhance edge cases non-blocking for video).
  `npm test` 2619/0. Guide + `sources.md` updated. **Next action:** Fabio reads the two prompts
  in the session report; on his yes, `mpi-end-session` (commit by pathspec; peer hunks in
  board.json/events.jsonl; MpiEnhanceDialog.css is a peer's, not ours). Message 28809bcb to
  MPI-1005 can be resolved: they landed 79e7e7006. **If tag-less still invents: escalate to Fabio** -
  options are (a) pass the staged handles so the enhancer cites only real ones (reverses the Q2
  pick), (b) route a tag-less ref2v prompt to a no-tag path in code, (c) accept invention.

## Plan Drift

- 2026-10-01 (Agent 81): **the "case-sensitive @ ban" is not a bug.** The only consumer of
  `forbiddenPatterns` that tests text is `scripts/recipe-test.mjs:214`, which compiles every
  pattern with the `i` flag (`brief.js` only prints them for Cosmo). Dropped from Phase 2; the
  ban only has to stay OUT of the new mode.
- 2026-10-01 (Agent 81): **no mode reaches the Enhance button today.** `MpiEnhanceDialog.js:173`
  calls `enhance({ prompt, model })` with no `mode`, so `resolveMode` returns `t2v` for every op.
  A ref2v mode alone would be dead code, exactly as Seedance's own `i2v`, Kling's `i2v` (Veo
  cards) and H3's `i2v`/`r2v` are now. The op-to-mode wire joins Phase 2 (root cause, same
  system). Files added to `files.json`.
- 2026-10-01 (Agent 81): the mode key is `r2v`, not `ref2v`: `registry.js:42` `RECIPE_MODES`.

## Phase 1 answers

1. **Mode pick.** `enhance()` (`llmService.js:754`) takes `mode`; `resolveMode` (`:337`) falls
   back to `t2v`. Its one caller, the Enhance dialog, never passes one. The prompt box knows the
   op (`activeOperation`, `MpiPromptBox.js:251`) and mounts the dialog at `:2323`. Models reaching
   a multi-mode recipe: `minimax-h3` (t2v_ms, i2v_ms), `minimax-h3-ref2va` (ref2v_ms),
   `seedance-2-cloud` (t2v, i2v, ref2v), `veo-31(-fast)-cloud` (kling-3.0: t2v, i2v).
2. **Staged refs.** Enhance does not know them; the prompt box does (`_stagedRefTags` +
   `refTagHandle`, `@image1` for Seedance via `capabilities.atRefTags`). **Pick: do not pass
   them.** The enhancer cannot see a reference, so given a staged list with no tags in the text
   it would have to guess each one's job (woman vs street), and a wrong job is worse than none.
   The mode keeps the user's tags verbatim and adds none. Upgrade path, only if Fabio's read of
   tag-less results asks for it: pass the handles as one context line.
3. **Shape.** Draft A: one anchor line per tag the user wrote, then one paragraph in vendor order
   (Cosmo's guide § ref2v and CINEDANCE both open on anchors; MPI-911 already chose vendor prose
   over CINEDANCE section labels). Fallback B, paragraph only with tags inline, if the 12B
   enhancer mangles A in the loop. The loop picks, not taste.

## Phase 2 design

- `llmService.js`: `recipeModeForOp(op)`: `ref2v*` -> `r2v`, `i2v*` -> `i2v`, else `t2v`;
  `enhance({ ..., operation })` uses `mode ?? recipeModeForOp(operation)`. Dialog passes
  `props.operation`; prompt box passes `activeOperation`. Test in `tests/llm-service.test.cjs`.
- `seedance-2.0.recipe.js`: the `@` ban leaves the shared list and is added back to t2v/i2v only;
  `r2v` bans `<Image 1>`-style tags instead (Seedance reads `<>` as a sound effect).
  `r2v` rules: every tag exactly as written, none added, none dropped; a tagged subject gets no
  appearance beyond the user's words (the reference is the truth), plus "matches the reference
  exactly"; each tag gets a job in words ("the street in @image2", "moves like @video1", "in the
  voice of @audio1"); a location reference gives the place, the prompt still writes shot size,
  lens and move; `@video1` as an edit master = one change, everything else locked to it; an
  acting line leads with its tag, written as states. Tag-less input: write as t2v but describe
  no appearance beyond the user's words, invent no tag. Budget 40-200 (aim ~120), measured.
- `scripts/recipe-test.mjs`: a deterministic "reference tags kept" check (every `@tag` in the
  input appears verbatim in the output, none new; no-op without tags), and `--ref-tiers`: four
  tagged inputs. Plain tiers still run on `r2v` to prove no tag is invented.
- Sweep cost (local Ollama, free, his GPU): `r2v` plain + ref tiers green twice (~4 sweeps x ~7
  min); `t2v` and `i2v` one confirming sweep each (only their ban list moved).

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
