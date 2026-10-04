# MPI-1018 validation

Verify mode: auto for the recipe (Stage 1 text-only loop); the recipe stays `draft` until Fabio sees real Wan 3.0 output (Stage 2 is his and costs money).

## 2026-10-04 — Stage 1, six rounds under the GPU lease

Command: `gpu_lease.py run -- node scripts/recipe-test.mjs wan-3.0 --engine gemma-4-abliterated-12b --judge gemma-3-12b --runs 3 [--mode i2v|r2v] [--ref-tiers]`

- t2v: ALL PASS twice (original draft text).
- i2v: ALL PASS twice on the final text.
- r2v with references (`--ref-tiers`): ALL PASS twice on the final text.
- r2v with no references: `directed` 0/3 and 1/3 (invents `<Image 1>`), every other tier 3/3. OPEN.
- `npm test`: 2710 pass, 0 fail.
- `guideIdsByModel()['wan3-cloud']` = `['guide:wan-3.0']` (the guide follows the recipe, so the flip is what stops Cosmo reading guide:wan-2.2).

Harness fix in the same job: `scripts/recipe-test.mjs --ref-tiers` wrote Seedance's `@image1` for every recipe; it now writes tags with `refTagHandle` on the recipe's own model (`<Image 1>` for Wan 3.0, Seedance unchanged byte for byte) and its tag check sees both forms.

Full record, iterations and known limitations: `docs/recipes/research/wan-3.0/validation.md`.

Shipped with the open case on the agent's pick (Fabio may reverse): the failing case is Enhance on ref2v before any reference is staged, and the wan-2.2 recipe it replaces is wrong for every Wan 3.0 mode.

## Stage 2, Fabio's live run 2 (2026-10-04)

Cosmo, guide:wan-3.0, ref2v 480p 2 s 4:3 with one 16:9 reference (tiger + rider, Deepinfra model tests,
ref2v_003). Prompt cites plain "Image 1" (not `<Image 1>`), one continuous action, sound line last
("No dialogue. No background music."). Identity held; Wan invented the frame's top to fill 4:3.
Fabio: "Came out great". $0.10. Still open: the `<Image 1>` bracket form on a real render, r2v with no refs.

## Closed 2026-10-04 on Fabio's verdict

Fabio, asked in session "Release 2.0 blockers 51": close it on run 2's "Came out great"; no more
renders, no spend. Known limits, accepted (Enhance edge cases do not block; Cosmo writes the video
prompts): (1) Enhance on ref2v before any reference is staged can invent `<Image 1>` on the
`directed` tier (Stage 1, 5/6); (2) the `<Image 1>` bracket form has passed the text loop but not
a real render. The recipe's `status: 'draft'` stays: `RECIPE_STATUSES` is a label nothing in
`js/` branches on.
