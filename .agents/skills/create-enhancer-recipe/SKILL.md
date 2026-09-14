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
2. **Re-run Phase 0** for the model, and **diff the vendor's documented format
   against the recipe for EVERY mode the recipe declares**: output sections, cut
   and timing notation, named fields, vocabulary. Vendor evidence is scoped by
   the vendor's own document, not by what the production shot — a base-mode
   guide covers the base modes even when the production never rolled one. A
   vendor skill published since the recipe was written belongs to the same
   merge; field evidence alone never surfaces a notation the production did not
   try.
3. **Classify every claim against the CURRENT recipe text**, as a table in the
   card. Two sources feed it, and both are required:
   - **the findings** — start from the production's own list of prompt-writing
     rules if it keeps one (a "read before writing" or "verified" section), then
     its dated entries. Every rule the production states is a row, including
     where the recipe is silent (`new`);
   - **the vendor diff from step 2** — one row per difference, per mode.

   | # | Recipe today (quote the rule or const) | Evidence (findings heading + line, or vendor file) | Mode | Basis | Verdict |
   |---|---|---|---|---|---|

   **Mode** is the mode(s) the row applies to, or `model`. **Basis** is
   `measured` (rolls, with the count), `vendor` or `inferred`. **Verdict** is
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
   vendor document covers.** Deferring one to another card is a reason only
   when it names the measurement it waits for. When the notation moves, move `dos`/`donts`
   with it in **every** mode — they are the judge's grading contract — and
   replace every ban the old notation needed. An objectively wrong output goes
   in `forbiddenPatterns`, not `donts`. *One format change per measurement*
   governs Stage 2: a render roll changes the output format or the content,
   never both. It does not multiply Stage 1 sweeps.
6. **Re-sweep every touched mode to green twice, on the final recipe text**
   (Phase 3). The count is per MODE, not per edit: a merge touching three modes
   owes six clean sweeps plus the iteration between them (~7 minutes each) — say
   that number up front. An edit after a mode goes green resets that mode, and
   a mode whose edits rest on vendor or inference alone owes the same twice.
   Local sweeps run under the GPU lease; never through `tee`.
7. **Hand back (Phase 4):** which contradictions are fixed, which modes are
   green twice, and which changed modes carry **no** field evidence — their
   edits rest on vendor or inference alone, so read their outputs, not the count.

## Done

The evidence files exist and are traceable, `npm test` validates the recipe as
`draft`,
Stage 1 is green on every tier across every run, and `validation.md` is ready
for review.
