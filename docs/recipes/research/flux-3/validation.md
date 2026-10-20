# Validation Record — FLUX.3 Klein (`flux-3`), draft

Recipe: `js/data/recipes/flux-3.recipe.js`. Sources: [sources.md](sources.md). Card: MPI-1181.
`t2v` = BFL's upsampler t2i system prompt verbatim + one Stage 1 adapter paragraph. `i2i` = BFL's
external-VLM i2i prompt verbatim + BFL's upsampler scope-opener sentence + one adapter sentence.

## Stage 1 — local probe (agent), 2026-10-20

- **Enhancer:** `huihui_ai/gemma-4-abliterated:12b` (Ollama) — the wording probe, NOT the count.
- **Judge:** `gemma3:12b` (Ollama). **Runs per tier:** 3. Every run under `gpu_lease.py`.
- **Command:** `node scripts/recipe-test.mjs flux-3 --mode <t2v|i2i> --engine gemma-4-abliterated-12b --judge gemma-3-12b --runs 3`

### Tally

| Mode / tier | Sweep 1 | Sweep 2 (after fixes) | Notes |
|---|---|---|---|
| t2v bare | 1/3 | 3/3 | 92 and 98 words under BFL's 100-word low end |
| t2v medium | 3/3 | 2/3 | one "is visible" (a blurred garden through a window) |
| t2v directed | 2/3 | 3/3 | "is visible" |
| t2v overlong | 3/3 | 3/3 | condensed 410 -> 259-296 words |
| t2v general | 2/3 | 3/3 | "is visible" |
| i2i bare / medium / directed / overlong | 3/3 each | 3/3 each | |
| i2i whole ("make it winter") | 0/3 | 1/3, then 3/3 (`--tier whole`) | see round 2-3 |

The judge scored every run intent=2 structure=2 format=2; every fail was a deterministic check.

### Iterations

| Round | Symptom | Change | Result |
|---|---|---|---|
| 1 | t2v: "In the background, X is visible" x2 — BFL's own anchor, closed with BFL's own banned phrase | adapter paragraph naming the POSITIVE shape ("In the background, a rainy garden stretches beyond the glass"), never quoting the ban (playbook 07) | 2 -> 1 slip in 15 runs |
| 1 | t2v bare: 92 / 98 words | same paragraph: "A short request still expands to at least 100 words." | bare 3/3 |
| 2 | i2i whole: "Change the season to winter ..." 3/3 | BFL's UPSAMPLER i2i states "a whole-image transformation opens with its scope (...)"; the external-VLM prompt we ship drops it. Sentence carried over verbatim | "Convert the entire scene ..." 1/3, "Transform the scene into ..." 2/3 |
| 3 | the check demanded the literal words entire/whole | `scripts/recipe-test.mjs`: also accept "the scene/image/landscape/picture/photo(graph)" after a transform verb — the same scope, BFL's rule does not name the word | whole 3/3 |

### Ladder

Held at the 12B probe; no escalation. The remaining slip (one "is visible" in 15 t2v runs) is
left for the count: the skill counts twice-green only on DeepInfra Gemma 4 26B, and a ban list
that grows per 12B slip is the failure playbook 07 warns about.

### Known limitations (for the 26B pass and Stage 2)

- The judge passed two t2v outputs that close on mood ("creating a sense of a hero standing in
  the final, quiet moment"), which BFL's prompt forbids and no regex catches.
- i2i "medium" wrote "allowing its eyes to be fully visible" (fine in an edit: it states the end state).
- `t2i` keeps BFL's SHORT upsampler prompt; the ~7,400-word external-VLM t2i does not fit Ollama's
  8,192 context. A DeepInfra-only long t2i is the fallback if Stage 2 finds the short one weak.

### Representative passing outputs (sweep 2)

- **t2v bare** ("cat", 128 w): Full-color studio photograph, a close-up portrait of a tabby cat sitting on a wooden surface. The cat has large, luminous amber eyes, a velvet-textured coat of swirled grey and orange fur, and a small pink nose. Its whiskers are long and white, fanning out from its muzzle. Positioned in the center of the frame, the cat's head is tilted slightly to the right, its ears peaked forward. In the midground, the polished oak surface shows a soft grain texture. In the background, a soft-focus garden provides a lush backdrop of deep green and muted yellow hues, with large, out-of-focus leaves creating a soft tapestry of color. The lighting is soft and directional from the upper left, casting a gentle glow that highlights the individual hairs of the coat.
- **t2v directed** (156 w): Close-up photograph of a weathered cowboy wearing a wide-brimmed leather hat, captured from a low-angle perspective through an anamorphic lens. The frame focuses intensely on the rugged texture of his skin, highlighting visible pores and fine wrinkles around the eyes. [...] In the background, a dusty desert plain stretches toward the horizon under a vast, hazy sky.
- **i2i bare** ("red swimsuit", 51 w): Change the teal-colored one-piece swimsuit to a vibrant red one. The suit should retain its ribbed texture, fitted shape, and scooped neckline, while the color change highlights the contrast against the teal water and the green tropical foliage. Keep the woman's pose, long two-toned hair, and the surrounding tropical background untouched.
- **i2i directed** (two references, 83 w): Create a composite image that places the hamster from the first image into the beach scene of the second image. The hamster should maintain its upright pose, wearing its detailed yellow firefighter's helmet with the red emblem and its small silver-rimmed aviator sunglasses. [...]
- **i2i whole** (85 w): Convert the entire scene into a winter landscape. The lush green grass on the rolling hills should be covered in a crisp layer of white snow, while the dense cluster of pine trees and the rolling hills are dusted with frost. [...]

Full logs of both sweeps were scratch files; re-run the command above to regenerate.

## Count — DeepInfra Gemma 4 26B (`--backend deepinfra --engine gemma-4-e4b`), 2026-10-20

Fabio's yes: 4 sweeps, ~6 cents. All 4 spent. NOT twice-green yet.

| Sweep | t2v | i2i | Fails |
|---|---|---|---|
| DI 1 (Stage 1 recipe) | 8/15 | 8/15 | t2v: "is visible" x4 (window / out-of-focus planes), "highly detailed" x3; i2i: "low camera angle" and "Do not alter ..." missed by the checks, the user's "realistic" carried through x2, 151-158 words x3 |
| local 12B round 3 | 14/15 | 11/15 | after round-4 wording below; the "not every element of the scene" clause made the 12B drop its keep-clause |
| local 12B round 4 | - | 15/15 | |
| DI 2 (round 4) | 10/15 | 14/15 | t2v: "is visible" x5; i2i: "realistic light reflections" x1 |

Changes between DI 1 and DI 2:

| Symptom | Change |
|---|---|
| t2v "Through the window, ... is visible" | adapter example moved to the window case; did NOT hold on the 26B |
| t2v "highly detailed" | "Name a detail itself (individual hairs, frayed silk cords) instead of calling a thing detailed." — held (0 in DI 2) |
| i2i quality words | the UPSAMPLER i2i's own "use no evaluative or quality words" (the external prompt we ship says "preserve every ... piece of wording", which carried "realistic, 8k" through) — 1 slip left |
| i2i over 150 words | "150 words is a ceiling, not a target." — held |
| check: "low camera angle", "Do not alter ..." | `recipe-test.mjs` accepts both (same direction / same keep-clause) |

### Second batch — Fabio's second yes, 4 sweeps (~6 cents), all spent

| Sweep | t2v | i2i | Fails |
|---|---|---|---|
| local 12B round 5 | 15/15 | - | |
| DI 3 (round 5) | 13/15 | 12/15 | t2v "Through the window, ... is visible" x2; i2i 159 / 161 words, "realistic highlights" x1 |
| local 12B round 6 | 15/15 | 14/15 | bare dropped its keep-clause once (passed 3/3 locally in rounds 1, 2, 4 and on every DI sweep) |
| DI 4 (round 6) | **15/15** | 14/15 | i2i whole at 151 words (cap 150) |

Changes:

| Symptom | Change |
|---|---|
| t2v "is visible" | BFL's own ban QUOTED the phrases it banned ('never "this image shows", "we can see" or "is visible"'), which playbook 07 names as the way a prohibition primes the words. Restated as "stating what is there and what it does, never what can be seen" (the ONE departure from BFL's text, Fabio's yes). Then the window became the verb's subject: "A view through a window belongs to the window's own sentence ("a tall window on the left frames a rainy garden in muted greens")". 10/15 -> 13/15 -> 15/15 |
| i2i over 150 words | the ceiling sentence now says how: "a whole-image change or a composition names its scope and its few largest changes, then what stays". 159-161 -> 151 |

### Where it stands

- t2v: green ONCE on the 26B (DI 4); twice-green needs one more sweep.
- i2i: 14/15 on DI 2 and DI 4. The whole-image tier ran over 150 words in 4 of its 12 DI runs,
  by 1-11 words; the other tiers are 3/3 on the last DI sweep.
- Spent on the count: 8 sweeps, ~12 cents (two yeses of 4).
- **Fabio, 2026-10-20: "Good enough: a 1-word overrun is harmless. Stop sweeping."** The count
  stops here, short of twice-green by his call; Stage 2 (renders) and the `validated` flip are his.

## `t2v_bbox` (Boxes) — probe, 2026-10-20

BFL's `t2i_bbox` verbatim; `enhance()` sends `upsamplingInput` and runs `reconcileBoxes` (BFL's
`bbox.py`, `js/data/layoutBoxes.js`). One probe, local `huihui_ai/gemma-4-abliterated:12b`,
`think: false`, "a fox <obj_1> and a bike <obj_2> in a meadow" with two boxes: one-line caption
citing `<obj_1>` `<obj_2>`, both boxes' coordinates unchanged, richer descs; rendered on the
bench, each subject inside its box (`.agents/mpi-kanban/tasks/MPI-1181/research/boxes/`). With
thinking ON the 12B answered EMPTY, so an empty box-mode reply is an error, never a table-only
prompt. Not counted (no sweep, no DeepInfra spend): a probe, like Stage 1's first round.

## Stage 2 — render (Fabio)

Not started. The `draft -> validated` flip is Fabio's.
