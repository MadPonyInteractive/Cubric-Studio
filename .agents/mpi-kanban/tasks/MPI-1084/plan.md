# MPI-1084 - LTX 2.3 Reference to Video enhancer (recipe r2v): right picture roles, real descriptions, green Stage 1

## Current State

Project mode: scalable-foundation. Follow-up to MPI-1060 (closed 2026-10-11; the op, composer, start frame and
docs shipped). Fabio read a real sweep output and called it a fail; this card makes the `r2v` enhancer mode right.
Fabio: "If you need the GPU, then you'll get the GPU in the next session."

**The recipe:** `js/data/recipes/ltx-2.3.recipe.js`, mode `r2v` (status `draft`; only Fabio flips it). What it
must produce is decided (MPI-1060 D5): one `<Picture n> [role:] description` line per attached picture, a blank line,
then the seven-sentence LTX scene. The app (`routes/ingredientsSheet.js` `parseSheetPrompt` / `sheetRoles` /
`sheetPrompt`) turns the picture lines into `### Reference Sheet Description` with cell names and roles. A role or
description the enhancer gets wrong goes straight onto the sheet the IC-LoRA reads.

**Failures seen (MPI-1060 validation.md § Recipe r2v Stage 1; outputs in that session's scratchpad, gone):**
1. **Wrong role.** Input "The man from `<Picture 1>` sitting on a rocking chair in `<Picture 2>` ..." gave
   `<Picture 2> a rocking chair`. "in `<Picture n>`" names a PLACE: it should be `<Picture 2> setting: ...`.
   The deterministic checks and the judge both passed it, so the sweep cannot see this today.
2. **Thin descriptions.** `<Picture 1> a man`. The bench (MPI-1060 results.md § Phase 2b) showed two-word labels
   lose the prop. The enhancer cannot see pictures (text-only, `llmService.js` sends no image), and the draft
   forbids inventing appearance. Decide the line: lift every detail the user's text gives that picture (the
   scene's words about it, its role, what it does), and say what it IS in a full phrase, never invent looks.
3. **`<Audio 1>` given a picture line** (2 of 3 overlong runs) despite the rule; forbiddenPattern catches it.
4. **Word floor:** bare outputs at 77-78 words against `wordBudget.min` 80.
5. **Nothing attached** writes a `<Picture 1>` line: NOT this card. MPI-1081 makes Enhance use the t2v mode
   when nothing is attached; once it lands the plain `--mode r2v` sweep tests a case the app never sends.

**Harness:** `npm run recipe:test -- ltx-2.3 --mode r2v --ref-tiers --engine gemma-4-abliterated-12b --judge
gemma-3-12b --runs 3`, ALWAYS under `gpu_lease.py run --poll 2` (plugin `skills/mpi-lib/scripts/gpu_lease.py`),
output to a file, never through `tee`. ~5 min a sweep once leased; the queue is the real wait. LTX ref tiers
(`scripts/recipe-test.mjs` `refInputs`): bare = cat + Picture 1; medium = the man/rocking chair/Picture 2;
directed = cowboy + Picture 1; overlong = samurai + Picture 1, 2 + Audio 1. Shared with Wan/Seedance: a tier
change there moves their baselines too.

**STATE AT HANDOFF (2026-10-11 ~20:30, session 5cddf24b) - read this first:**
- Done and verified: harness `picture role` + `<Audio n> in the scene` checks (`scripts/recipe-test.mjs`); recipe
  thin-line floor; `routes/ingredientsSheet.js` drops `<Audio n>` lines (Fabio's yes, test in
  `tests/ingredients-sheet.test.cjs`, 13/13 with recipe-registry + agent-corpus). Ref2v runs on a RunPod Pod (dev).
- Wording: sweep G 10/12 (all picture lines right; directed invented `<Audio 1>` 2/3 because of a sentence-6 audio
  clause, now REMOVED; "write none" reworded). Sweeps I and J on that text were running at handoff, output in
  `C:/Users/Fabio/AppData/Local/Temp/claude/C--AI-Mpi-Cubric-Vision/5cddf24b-0b82-4a49-bb98-94d71375f00a/scratchpad/step3-full-{i,j}.txt`
  (read with `grep -n -E "^--- |^<(Picture|Audio) [0-9]>|\[XX\]|ALL PASS|FAILURES"`). Both ALL PASS = Step 3 green.
  The sweep script is `sweep.sh` in that same folder (gpu_lease --poll 2, node direct); copy it to the new scratchpad.
- **NEXT (Fabio approved 2026-10-11): the DESCRIBE STEP.** Root cause of "Enhance fails 90%, the sheet shows in the
  clip": the enhancer is text-only, the user does not tag pictures, so it guesses by order (live `ref2v_004` in project
  "X2.3 references": guinea pig labelled "setting: forest clearing", valley labelled "prop: the orange"); the sheet's
  descriptions then mismatch the cells and LTX pastes the sheet. Cosmo, who looks at the pictures, "nailed it".
  Design: in `js/services/llmService.js` `enhance()`, r2v mode only, before the LLM call, describe each staged picture
  and append "what each picture shows" to the user text after the Attached line; recipe r2v tells the model to take
  roles and descriptions from those captions (place = setting:, object = prop:, person/creature = character).
  Reuse, never re-describe: the description lives in the card sidecar `Media/.meta/<itemId>.json` field `look`
  `{ text, describer, at }`, the same field Cosmo's `look` reads/writes (`services/agentTools.mjs` `storedLook`/
  `storeLook`, MPI-870). Verified: imported cards HAVE sidecars and Cosmo's looks are saved there. Read via
  `POST /load-meta-batch {folderPath, ids}` (routes/projects.js:3650), describe via `describeImage({imagePath})`
  (llmService.js:1069), write via `POST /project-media/:id/update-meta?folderPath=` `{itemId, updates:{look}}` (never
  create a sidecar). The prompt box passes `references` as tag strings only (`MpiPromptBox.js:2464`
  `_stagedRefTags()` -> `{tag, item}`); also pass each picture's path + itemId. Fabio: Enhance cost = one describe per
  NEW picture; DeepInfra describes are paid. Then a harness tier with captions, sweep, Fabio's eye test.
- Identity (separate card MPI-1096, in todo): a character sheet ALONE keeps the face; sheet + forest loses it (A/B
  `ref2v_005` vs `ref2v_002`, same seed, Fabio: "that looks more like the same guy"). Face-size rule DROPPED (face only
  -15% on the sheet). Fabio OK'd testing Best-Face-ID on `G:\ComfyUi` (BFS Nodes from GitHub + CharacterSheet LoRA
  ~1 GB from HF; back up the bench's pip list first, insightface install). Licence: none stated = cannot ship;
  emailing the author is Fabio's. Notes: `.agents/mpi-kanban/tasks/MPI-1096/research/shortlist.md`.
- Your call still open for Fabio: keep a setting picture OFF the sheet when a character is on it (text only), or as a
  small cell? Needs a Pod A/B first.

**Progress (2026-10-11, session 5cddf24b):** Step 1 DONE (harness `picture role` check + recipe thin-line floor,
0/3 on the old text). Step 2: roles and descriptions fixed (bare/medium/directed 9/9 in full sweep B). Only failure
left: overlong writes an `<Audio 1>` line in the picture block, 9/9 across three wordings, 1/3 on the fourth (literal
Attached-line example). Waiting on Fabio: make `routes/ingredientsSheet.js` `parseSheetPrompt` skip an `<Audio n>`
line (shipped MPI-1060 file, outside this card's files) vs keep pushing wording. Evidence table: validation.md.
Sweep script: scratchpad `sweep.sh <out> [--tier T]` (gpu_lease, --poll 2, node direct).

## Plan

### Step 1: Make the failures visible to the sweep
- [ ] Add a deterministic check (or a recipe `forbiddenPatterns` entry) for the role case: on the `medium` ref
  tier the `<Picture 2>` line must be a setting. Prefer a recipe-level pattern; a harness check must stay
  model-agnostic (Wan/Seedance have no picture lines). Add a description-length floor per picture line if the
  recipe can express it (e.g. a forbiddenPattern for a `<Picture n>` line under ~5 words).
  **Verify:** re-run the medium tier on the CURRENT text: the new check FAILS where the old sweep passed.

### Step 2: Fix the wording
- [ ] Role rule: "in / at / inside `<Picture n>`" = a place -> `setting:`; "wearing / holding / carrying"
  `<Picture n>` = `prop:`; "the man from `<Picture n>`" = the character. Description rule per failure 2.
  Audio rule once more if failure 3 persists (consider an example output in the systemPrompt).
  Word floor: lower `wordBudget.min` only if the outputs are right and just short (the t2v mode's floor is the
  reference), never to pass a bad output.
  **Verify:** `node --test tests/recipe-registry.test.cjs tests/agent-corpus.test.cjs`; one tier at a time
  (`--tier medium`), then the full `--ref-tiers` sweep.

### Step 3: Green twice, then read the outputs
- [ ] Full `--ref-tiers` sweep green TWICE on the final text (3 runs each). Then READ every picture line: a green
  count with a wrong role is still a fail (this card exists because of exactly that).
  **Verify:** both summaries "ALL PASS"; outputs pasted into `docs/recipes/research/ltx-2.3/validation.md` (new,
  template `.claude/skills/create-enhancer-recipe/references/validation-record.md`).

### Step 4: Stage 2 hand-off to Fabio
- [ ] Give Fabio the four final prompts to render on LTX Balanced -> Reference to Video with real pictures (his GPU).
  The `draft -> validated` flip is his. Sync `docs/agent/models/ltx-2.3.md` if the prompt rules changed.

## Verification

**Verify mode:** user-ux (Step 4 is Fabio's render; Steps 1-3 are agent-verified).

## Files

`js/data/recipes/ltx-2.3.recipe.js`, `docs/recipes/research/ltx-2.3/`, `docs/agent/models/ltx-2.3.md`,
`scripts/recipe-test.mjs` (only if a check must live there), card folder. Procedure: `/create-enhancer-recipe`.
