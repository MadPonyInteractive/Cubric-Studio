# MPI-1090 plan - Clothes reference, round 2

Umbrella MPI-1091. Brief: `brief.md`.

## Current State

2026-10-11 (session "New character sheets 21"): card in doing. Fabio's two runs re-read from sidecars:
flowCSE_011 (no words, seed 3465439644) and flowCSE_012 ("G string on the back view", seed 543448490) both took
the HEADLESS sheet `flowCharacterSheet_012` as input (the MPI-1089 bug, fixed since). Their with-head twin is
`flowCSE_010.png`. Reference: `Media/.preview-assets/a551508f....jpg` (408x741, black high-neck bodysuit dress with
lace-up side cut-outs, front only).

What the pictures show (not quite what the brief says):
- 011 back view: NOT an invented outfit - the edit never reached the back. It kept the OLD black tube top and cut
  the old trousers to shorts. Front dress charcoal, close-up black and right.
- 012: front figure redrawn as a second back view; both bodies in a bikini (the words were read as THE outfit).

Round 1 benched (validation.md): grey = headless input; the old top on the back = lock 1 freezing the braids as a
solid block (mask render, `qg2_mask.py`); close-up neckline 2/12 = prompt; words in their own sentence carry the
G-string to the back 3/3.
Fabio said yes to the shoulder lock. Round 2 (`qg4.py`): it frees the back (old top gone 3/3 with words); LWC = front,
back, layout 3/3, close-up 0/3; LC (no words) close-up 3/3. LANDED UNCOMMITTED: the lock patched into
`comfy_workflows/raw/flow_character_sheet_edit.json` by `research/bench/patch_raw.py`, converted + injection-gated for
this ONE file by the scratchpad `sync_one.mjs` (the full `sync-raw-workflows.mjs` would also convert AND COMMIT peer
MPI-1071's untracked `raw/flow_transcribe.json`); generated API proven node-for-node equal to qg4's benched graph.
SHIPPED f3ec8cb40 (pushed): shoulder lock graph + builder (LC no words, X3 with words, `_unview`) + tests + playbook.
Card validating. NEXT: Fabio's eye test (reload the app; Clothes + his dress reference on a with-head sheet, no words
and "G string on the back view"). Fabio is building an image combine so a user can give a front+back reference:
bench a two-view reference then (risk: a second figure in the reference drew an extra figure, MPI-1041 F2 round 2).
2026-10-11 evening: Fabio made it - `Qwen 2.1/Media/sheet_001.png` (1536x2048, Combine Images: the dress front +
a full-length side/back photo; the dress is long at the back, NOT a bodysuit). GPU is free for agents. Round 5 =
shipped strings (LC no words, X3 with words) with sheet_001 as the reference on the with-head sheet, 3 seeds each;
watch for an extra figure. Results go in validation.md; then Fabio's eye test.

## Plan

1. Bench on the with-head sheet, lock 1, Input_Reference true:
   - baseline: the shipped no-words string (DN) on Fabio's seed + 42 + 7: is the grey the headless input?
   - E (no words): DN + "in the same colours" + the back named the safe way ("the character seen from behind",
     0/10 layout redraws on accessories, F1) wearing the back of the same outfit.
   - repro: the shipped words string with "G string on the back view", Fabio's seed.
   - W (words): the reference clause stays whole; the user's words go in their OWN sentence as a change to that
     outfit, with view names rewritten ("the back view" -> "seen from behind"). Cases: "G string on the back
     view" (3 seeds), "in red" (2 seeds, a no-view change must still work).
2. Builder: `buildChangePrompt` ref branch takes the winners; a view-word rewrite on the user's words.
3. Tests in `tests/character-sheet-editor.test.cjs`; playbook `docs/playbooks/add-flow/existing-flows/character-sheet-editor.md`.

## Verification

**Verify mode:** user-ux

- Bench evidence in `validation.md` (eye-read of every image, per case pass/fail).
- `node --test tests/character-sheet-editor.test.cjs` passes.
- Fabio re-runs his dress on a with-head sheet, no words and "G string on the back view".

## Completed

(none yet)

## Plan Drift

- 2026-10-11: brief said the back was "invented as shorts"; the pictures show the edit missed the back view and kept
  the old clothes. The fix is to reach the back, not to describe it.
