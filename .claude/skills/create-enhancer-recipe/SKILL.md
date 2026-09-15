---
name: create-enhancer-recipe
description: Author, test, iterate and heal a per-target-model prompt recipe for the Cubric Vision Enhancer. Use when adding support for a new target model (Krea, Veo, Seedance, Kling, Wan, LTX, SDXL, Flux, …), refreshing one for a new model version, revising an existing draft recipe, or healing one when a real production's findings contradict it — the research → draft → autonomous test loop that produces a proven draft recipe plus traceable evidence, and the return path from field evidence. Triggers: "add a recipe for X", "support model X in the enhancer", "create an enhancer recipe", "revise the X recipe", "heal the X recipe", "field evidence for X", "$create-enhancer-recipe".
---

# create-enhancer-recipe

The executable procedure. The reasoning behind every step lives in
[`docs/recipes/playbook/`](../../../docs/recipes/playbook/README.md) — read it
once; this skill is the step-by-step you follow each time. The recipe schema is
[`js/data/recipes/registry.js`](../../../js/data/recipes/registry.js) (source of
truth, never restated here). The rules are
[`.claude/rules/engine-recipes.md`](../../../.claude/rules/engine-recipes.md).

**Input:** a target model name + version. **Output:** a `draft` recipe at
`js/data/recipes/{model-id}.recipe.js` that has **passed the Stage 1 loop**,
plus evidence at `docs/recipes/research/{model-id}/`. A **heal** starts from a
card instead — see Phase 5.

## Hard rules

- **Never set `status: 'validated'`.** You author drafts and report scores. Only
  Fabio flips it, after seeing real-model output.
- **Never render.** Stage 1 is text-only. Generating images/video is Stage 2 and
  it is Fabio's, and it only happens after Stage 1 passes cleanly.
- **Version-pinned, provenance-preserving.** Exact version, research date, 3–6
  sources with tier + access date, claim-to-source notes.
- **Paraphrase, preserve citations.** Never copy substantial third-party prompt
  examples into a shipped recipe.
- **Stay in your lane.** `docs/recipes/research/**`, one
  `js/data/recipes/{model-id}.recipe.js`, and `registry.js`. Not
  the enhance path, not the connector, not dependencies.

## Phase 0 — The vendor's prompting skill → the specification

Full detail: [playbook 08](../../../docs/recipes/playbook/08-vendor-prompt-skills.md).
**This runs before web search.** A recipe's `systemPrompt` *is* a prompting
skill; the ones that already exist for the target model are the closest thing to
a spec you will get, and for some models they are how every serious user writes
a prompt at all.

1. **The vendor's own repo, including dotfolders.** List the tree rather than
   guessing a path — MiniMax's H3 skill lives at `.claude/skills/`, there is no
   root `skills/` folder, and looking for one found nothing for four sessions:
   ```bash
   gh api repos/<org>/<repo>/git/trees/main?recursive=1 --jq '.tree[].path'
   ```
2. **The community ecosystem, by stars.** Not optional for models that have one:
   Seedance's top prompting skill carries 3,315★.
   ```bash
   gh api "search/repositories?q=<model>+skill&per_page=10" \
     --jq '.items[] | "\(.full_name) — ★\(.stargazers_count)"'
   ```
3. **Diff a vendor skill's references against the model card's `docs/`** before
   reading both — on H3 they were byte-identical, and knowing that is what
   stopped a duplicated read.
4. Record in `sources.md` what was found, what was adopted, and what was
   rejected **with a reason**. "I could not find one" is a finding; "there isn't
   one" is a claim that needs the search behind it.

## Phase 1 — Research → `sources.md` + `research.md`

Full detail: [playbook 01](../../../docs/recipes/playbook/01-research.md).

1. **Web search always runs**, even when notes already exist — for an existing
   recipe the job is to confirm or contradict each current claim. 3–6 sources,
   official docs first. Record tier + access date + URL in `sources.md`.
2. **NotebookLM if a notebook exists** (Fabio curates, you query):
   ```bash
   notebooklm list --json
   notebooklm ask -n <notebook-id> "<question>" --json
   ```
   Always `-n <id>`; **never `notebooklm use`**. No notebook is **not** a
   blocker — note it and continue on web search.
3. Answer the 7 questions into `research.md` with claim-to-source notes.
   **Question 1 must yield a number** — the word budget is machine-checked.
4. **Any finding that is a list of words gets MEASURED, not read.** Two
   vocabulary sets authored from documentation and intuition both measured at
   ~zero against 209 real prompts, so counting is not optional. **The raw prompt
   corpus is NOT in this repo** — it is a gitignored Civitai scrape that stayed
   in Cubric-Prompt (Fabio, 2026-09-02), and the scraper has not been ported.
   The measured *conclusions* did travel: per-term percentages for `pony`,
   `illustrious` and the candid register are in
   `docs/recipes/research/{model-id}/`. A NEW vocabulary claim therefore needs a
   corpus scraped fresh — count on a *split* corpus with *whole-word* matching,
   and record the split per kept term.

## Phase 2 — Draft → `{model-id}.recipe.js`

Full detail: [playbook 02](../../../docs/recipes/playbook/02-draft.md).

1. Map findings to the recipe shape (`validateRecipe()` in `registry.js` is the
   spec). One `modelId`, a `modes` map. **Set `wordBudget`** — without it the
   condense job cannot be checked.
2. Write the self-contained `systemPrompt`. It must state **all four jobs**
   (expand / rearrange / condense / infer intent), the element order, the budget
   as a number, and an absolute output-format rule as its last line.
3. Register in `registry.js` (in a parallel batch, the orchestrator owns that
   edit — report your `{model-id}` + export name instead), then run
   `npm test`. There is no Zod here: `validateRecipe()` replaced it, so a
   malformed recipe **fails at test time, not at import**. Skipping the tests
   means shipping it broken.
4. **Leave `styleVocabulary` off.** A register (`cinematic`/`general`/`candid`)
   is cross-cutting, not a fifth job, and it is proven on `krea-2` only. Adding
   it is a separate, corpus-measured pass:
   [playbook 06](../../../docs/recipes/playbook/06-registers.md).

## Phase 3 — Stage 1, the autonomous loop

Full detail: [playbook 03](../../../docs/recipes/playbook/03-test-loop.md).
**Run this yourself, to completion, without asking.**

```bash
npm run recipe:test -- <recipe-id> --engine dolphin3-abliterated --judge gemma-3-12b --runs 3
```

1. Run all four tiers × 3 runs. The harness applies the deterministic checks and
   an LLM judge, and exits non-zero on any failure.
2. On a failure, change **the rule that caused it** (the playbook's §3.4 table
   maps symptom → fix), re-run just that tier (`--tier <name>`), then a full
   sweep to confirm.
3. **Done = every tier passes every run.** 2/3 is a failing tier, not a pass.
4. Model too weak to follow a clearly-stated rule? Climb
   [playbook 05](../../../docs/recipes/playbook/05-model-ladder.md) — small
   uncensored rungs first, a VRAM bump only as a recorded finding.
5. Write `validation.md` ([template](references/validation-record.md)): models
   used, run tally, final prompt per tier, every iteration and why, known
   limitations.

## Phase 4 — Hand over, then stop

Present the four final prompts + `validation.md` to Fabio for Stage 2 rendering
([playbook 04](../../../docs/recipes/playbook/04-promote.md)). **Stop there.**
The `draft → validated` flip is his.

## Phase 5 — Heal: a real production contradicts the recipe

Full reasoning: [playbook 09](../../../docs/recipes/playbook/09-field-evidence.md).
**The trigger is a card Fabio files** (decided 2026-09-14). Not a model version
bump, not your own reading of a findings doc. No card, no heal.

**The heal card names four things.** Ask Fabio for any that is missing before
reading anything else:

- the recipe id;
- the mode(s) the production **actually shot** — every claim inherits this;
- the findings path — read in place, never copied into this repo;
- Fabio's instruction, verbatim — what he wants fixed, and anything ruled out.

1. **Scope first.** Write the production's mode(s) once, at the top of the merge
   notes in the card's `validation.md`. A finding in a mode the production did
   not shoot is a **hypothesis** for that mode, never a result — modes share a
   recipe file and rule consts, which is exactly how a claim drifts across them.
   **The exception is a fact about the MODEL, not about a mode's output** — its
   text encoder, a node's inputs. It holds for every mode that runs on the same
   encoder or node, once you have checked that they do; tag those rows `model`.
   **A `model` fact that overturns a limit contradicts every recipe value SIZED
   to that limit** — `wordBudget` first, and any cap or const derived from it —
   in every mode on that encoder or node. Each is its own `contradicts` row,
   never a note about the model: the enhancer writes to the recipe's number,
   not to the model's. An exact value you cannot measure here is not a deferral
   — size it from the fact or the vendor document, and step 6 tests it.
2. **Re-run Phase 0** for the model, and **diff the vendor's documented format
   against the recipe for EVERY mode the recipe declares**: output sections, cut
   and timing notation, named fields, vocabulary. Vendor evidence is scoped by
   the vendor's own document, not by what the production shot — a base-mode
   guide covers the base modes even when the production never rolled one. A
   vendor skill published since the recipe was written belongs to the same
   merge; field evidence alone never surfaces a notation the production did not
   try.
3. **Inventory, then classify: two passes, both written into the card.** A
   table built from what looks important skips rules, and a rule that never
   becomes a row is one no edit gets checked against. The inventory turns a
   skipped rule into a missing number.

   **3a. The rule inventory, from the findings and the step 2 diff, not the
   recipe.** Walk the production's rule sections (a "read before writing" or
   "verified" section) heading by heading, then EVERY dated entry to the end of
   the file. Write one numbered line per rule stated: heading, line, and the
   rule quoted exactly. A rule is any sentence telling a prompt writer what to
   write or not write, wherever it sits: a bold rule sentence or a rule
   subheading inside a dated entry, and a rule stated in passing inside a
   descriptive section, count the same as a bullet under "verified". Nothing is
   left out for seeming minor, already handled or specific to one shot; judging
   is step 5's job. Then add every difference the step 2 vendor diff found, one
   line per mode, including any you expect to defer; a difference that never
   becomes a line is never decided. End the inventory with its count.

   **3b. Classify every inventory line against the CURRENT recipe text.** Every
   line gets a row, and several lines may share a row that lists all their
   numbers: rules the recipe already follows (`confirms`), rules it breaks
   (`contradicts`), rules where it is silent (`new`). **Quote, then search, then
   classify:** the "Recipe today" cell is text copied from the recipe, and you
   search the recipe for that exact text before writing the row. A row says
   `confirms` or `contradicts` only when its quote is found verbatim and says
   what the verdict claims; a quote you cannot find means the recipe is silent,
   `new`, whatever you remember reading. A paraphrase never goes in that cell.
   When the table is done, every inventory number appears in it.

   | # | Inventory # | Recipe today (verbatim quote, found in the recipe) | Evidence (findings heading + line, or vendor file) | Mode | Basis | Verdict |
   |---|---|---|---|---|---|---|

   **Mode** is the mode(s) the row applies to, or `model`. **Basis** is
   `measured` (rolls, with the count — rolls that tested THIS rule, not a
   neighbour of it), `vendor` or `inferred`; a vendor syntax the findings call
   untested is `vendor` in every mode. **Verdict** is
   `contradicts`, `confirms` or `new`. A claim with no citation does not enter
   the table. Record the confirmations too, so nobody re-opens them.
4. **Harvest before editing** — cheap and permanent first, because the sweeps
   may not finish: the table into the card; a `sources.md` row for the
   production, in the shape of the rows already there (tier: in-house
   measurement, Stage 2), in `docs/recipes/research/{model-id}/`; anything that
   generalises beyond this model proposed for `.claude/rules/engine-recipes.md`
   — a rule edit needs Fabio's explicit yes.
5. **Edit the recipe.** Every `contradicts` and `new` row becomes an edit, or a
   written reason for not making it. **A `model` row's edit lands in every mode
   that runs on that encoder or node, and a `vendor` row's in every mode the
   vendor document covers.** **A notation the vendor documents replaces the
   recipe's own in THIS merge** — cut and shot markers, timing stamps, named
   fields — in every mode that document covers: the recipe's notation was a
   guess, the vendor's is the specification (Phase 0). A format the recipe
   already rejects with a written reason stays rejected unless the evidence
   answers that reason — and the rejection covers only what its reason names,
   never syntax the findings measured on its own. Deferring a row to another
   card is a reason only when it names a measurement this heal cannot run — a
   Stage 2 render, or a decision of Fabio's QUOTED from the card or the
   findings, never inferred. A Stage 1 sweep is never that measurement: step 6
   runs it on this merge. **A vendor notation that replaces one the recipe
   already has is never deferred, not even to a Stage 2 render** — the notation
   sentence above already decided it, and the vendor document is its evidence.
   A vendor label with no counterpart in the recipe replaces nothing: it is an
   ordinary `new` row, adopted or deferred on the rules above. **Before writing any edit, check it against every
   `confirms` row:** an edit that would break a confirmed rule is not made — it
   is a conflict, resolved in the table first. When the notation moves, move `dos`/`donts`
   with it in **every** mode — they are the judge's grading contract — and
   replace every ban the old notation needed. An objectively wrong output goes
   in `forbiddenPatterns`, not `donts`. *One format change per measurement*
   is a Stage 2 rule about render rolls: a roll changes the output format or
   the content, never both. It never defers a heal edit, and it does not
   multiply Stage 1 sweeps.
6. **Re-sweep every touched mode to green twice, on the final recipe text**
   (Phase 3). The count is per MODE, not per edit: a merge touching three modes
   owes six clean sweeps plus the iteration between them (~7 minutes each) — say
   that number up front. An edit after a mode goes green resets that mode, and
   a mode whose edits rest on vendor or inference alone owes the same twice.
   Local sweeps run under the GPU lease; never through `tee`.
7. **Hand back (Phase 4):** which contradictions are fixed, which modes are
   green twice, and which changed modes carry **no** field evidence — their
   edits rest on vendor or inference alone, so read their outputs, not the count.
   **Then put four checks on the card for Fabio.** Cold dry runs of this phase
   (MPI-677 step 4c, seven graded runs) missed each of these repeatedly, so a
   heal is not trusted on them until he has looked:
   - **Notation moved in every mode the vendor document covers**, not only in
     the mode the production shot.
   - **Rules inside dated entries are in the inventory** — spot-check the
     findings' later entries against it; a stretch called "no rules" is where
     they go missing.
   - **Every `confirms` quote is really in the recipe** — a sentence read in the
     playbook or the findings gets remembered as recipe text.
   - **Rules stated in passing are rows** — a ban inside a description of the
     prompt's shape, a bold rule sentence at the end of an entry.

## Done

The evidence files exist and are traceable, `npm test` validates the recipe as
`draft`,
Stage 1 is green on every tier across every run, and `validation.md` is ready
for review.
