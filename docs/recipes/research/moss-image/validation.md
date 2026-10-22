# Stage 1 validation — moss-image

Recipe: `js/data/recipes/moss-image.recipe.js`, mode `t2v` only. Status stays `draft`: the
`validated` flip is Fabio's, after Stage 2 renders.

- **Date:** 2026-10-22 (MPI-1243, session "Moss image 4").
- **Engine:** `huihui_ai/gemma-4-abliterated:12b` (Ollama), the local wording probe.
- **Judge:** `gemma3:12b` (Ollama).
- **Runs:** 3 per tier, four job tiers + `general` (no `styleVocabulary`, so no register tiers).
- **Command:** `npm run recipe:test -- moss-image --engine gemma-4-abliterated-12b --judge gemma-3-12b --runs 3`,
  under `gpu_lease.py run --poll 2`.

## Result on the final recipe text

**15/15 ALL PASS** (bare 3/3, medium 3/3, directed 3/3, overlong 3/3, general 3/3). Word counts
90-163 on the job tiers, 226-281 on `overlong` (input 410). Judge 2/2/2 on every run.

**DeepInfra Gemma 4 26B** (`--backend deepinfra --engine gemma-4-e4b`, the model users' Enhance
runs; Fabio's yes for two sweeps, 2026-10-22):

- Sweep 1 (iteration 6 text): 14/15. One `overlong` run wrote "highly detailed, battle-worn
  traditional armor": the input says "extremely detailed", and the template's ban quotes the phrase.
- Iteration 7 (below), sweep 2: **15/15 ALL PASS**, 154-241 words, no "detailed" in any output.
  The local 12B is also 15/15 on this text.
- **Green ONCE on the 26B, on the final text.** Twice-green owes one more 26B sweep (~1.5 cents).

## Iterations

| # | Change | Result |
|---|---|---|
| 1 | Comfy-Org template prompt verbatim + adapter paragraph (condense, garbled intent, 80-word floor); `wordBudget` 80-200 from the template | 12/15: `overlong` 0/3 at 251-276 words. Content good: the template's "keep everything" kept all ~30 details |
| 2 | Adapter: "give each detail a few words ... 200 words is a hard ceiling" | `overlong` 0/3 (263-277). Rewording the number moved nothing (playbook 07 rung 1 next) |
| 3 | Rung 1+2: "not shortened: pick out ... write a fresh caption from those notes", cap as nine sentences | `overlong` 0/3 (248-300, 10-13 sentences). The sentence cap was ignored too |
| 4 | Rung 3, the number: `wordBudget.max` 300, prompt "under 300". Sources: the vendor skill says "avoid arbitrary word budgets"; the template's 200 is "usually"; MOSS reads ~4K tokens, so a long caption is not truncated | 15/15. But 3 of 5 tiers opened "An oil painting of ..." for a request naming no medium |
| 5 | Adapter: "A request that names no medium or style is a photograph" (FLUX.3's rule, the card is a photo model) | 14/15: `overlong` one run at 310 |
| 6 | Prompt asks for "under 250" (the 12B overshoots a stated cap by ~10%); check stays 300 | **15/15**. 15/15 outputs open on a photograph |
| 7 | Adapter: "Name a detail itself (the dents in the armor, individual hairs, frayed silk cords) instead of calling a thing detailed" (FLUX.3's fix for the same 26B leak; the template's quoted ban is left verbatim) | 26B 15/15, 12B 15/15 |

## Final prompts (run 1 of the final sweep)

- **bare** ("cat", 115 words): "A soft, close-up photograph of a fluffy ginger tabby cat sitting in a
  sun-drenched garden. The cat is centered in the frame, its head slightly tilted to the right ..."
- **medium** (117): "A cozy photograph of a man sitting in a wooden rocking chair by a stone fireplace
  in a warm, rustic living room. Two fluffy cats rest comfortably at his feet on a woven rug ..."
- **directed** (129): "A close-up photograph of a rugged cowboy wearing a weathered leather hat,
  captured in a low-angle shot ... extreme skin detail, showcasing visible pores ... the cinematic
  depth of an anamorphic lens."
- **overlong** (226): "A cinematic film photograph of a lone samurai warrior standing at the edge of a
  jagged cliff ... The color grade features warm highlights and cool shadows ..."
- **general** (148): "A cozy photograph of a woman sitting by a window, holding a ceramic mug as she
  drinks coffee ..."

Full outputs: rerun the command above; the harness prints each.

## Known limitations

- **No text tier.** Lettering is MOSS's headline, and none of the harness's tiers asks for text, so the
  quoting/placement rules are untested in Stage 1. Stage 2 must include a sign or poster request.
- **Praise and mood words leak** ("beautiful bokeh", "peaceful atmosphere"): the template bans quality
  keywords, not mood words, and the judge passes them. Not added to `forbiddenPatterns`: harmless to a
  caption model, and a growing ban list is playbook 07's warning sign.
- **"Thufpik" resolves vaguely** ("in the middle of the action of shooting"), never copied through.
- **`overlong` sits near its ceiling** (226-281 of 300). A 26B run may land differently.
- Boxes: the enhancer receives the `editPlacementInput` PLACEMENT list, which says "the edited image"
  even on this t2i model. Wording mismatch in the app, not this recipe; noted on MPI-1243.
