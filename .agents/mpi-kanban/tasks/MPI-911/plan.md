# Rebuild the Seedance 2.0 skill from the Higgsfield director skill

## Current State

Project mode: scalable-foundation.

**Status (2026-09-24): implemented and Stage 1 green twice in both modes on the final text. Next: `mpi-end-session`. The bullets below are the planning-time facts.**
Handed off 2026-09-25 (handoff `f8ae245f`) with the work committed; close-out is the only step left.

- **Two consumers, both rewritten.** The enhancer recipe `js/data/recipes/seedance-2.0.recipe.js`
  (265 lines, `draft`, modes `t2v` + `i2v`, no `wordBudget`) is what the small local LLM in the
  Prompt Box follows. The agent guide `docs/agent/models/seedance-2.0.md` (91 lines, gated router)
  is what the in-app agent reads. Both come from ten community blog posts via NotebookLM
  (`docs/recipes/research/seedance-2.0/sources.md`, tier 3-5 only; the tier 1-2 rows there were
  recorded and never read).
- **The sources.** `.agents/mpi-kanban/private/seedance-skills/` (gitignored, `.gitignore:38`):
  - `CINEDANCE HIGGSFIELD SKILL.md`, 1,330 lines. The primary source. Higgsfield is a serving
    platform, not ByteDance, so it ranks with Krea's skill in playbook 08 (tier 1-2, platform
    vendor), and Fabio names it more accurate than everything we have. Basis for its rows: `vendor`.
  - `ACTING SKILL.md`, 444 lines. Seedance 2.0 character performance. Same basis.
  - `prompt-builder-2-5.skill`, a zip holding `seedance-clean/SKILL.md`, whose frontmatter says
    **Seedance 2.5**. The playbook 08 version trap: filed under 2.5, never 2.0 authority. A rule
    it shares with the 2.0 skill is corroboration, noted on that row, nothing more.
  - `LIRA SKILL.md`, 619 lines. Image prompting for Higgsfield's image models; its video note is
    a pointer. Rejected with that reason.
- **The origin repo is PUBLIC** (`MadPonyInteractive/Cubric-Studio`). No sentence of those files
  may land in any committed file: recipe, guides, `sources.md`, `research.md`, and this card's
  own `validation.md`. Evidence cells cite heading and line, and paraphrase.
- **Where our text disagrees with the director skill** (card description): lens by diagonal
  field of view in degrees, never mm or f-stops; a short optional quality suffix, not the long
  mandatory one both modes append verbatim today; first-frame occupancy, spatial blocking, gaze
  and landmark locks; lighting as a lock; minimal identity anchors per reference; local positive
  locks over a negative block. Also found at planning: it defaults to ONE continuous take and
  cuts only when asked or when the action cannot be staged, where our `i2v` is a 3-5 segment
  timeline by default; and it keeps settings the UI already sets (duration, ratio, resolution)
  out of the prompt.
- **What the app sends** (`js/data/modelConstants/models.js`, `seedance-2-cloud`): the prompt and
  one image as `first_frame_image`. Nothing else. The `i2v` mode today writes `@Image1..9`,
  `@Video1..3`, `@Audio1..3` jobs and declares `acceptsMedia: ['image','audio','video']`, which
  `brief.js` shows the agent. Wiring the references is MPI-910.
- **MPI-903 folder support is in** (`services/agentCorpus.mjs` `subSkillTopics`, `guideEntries`,
  `guideIdsByModel`). `docs/agent/models/seedance-2.0/<topic>.md` lists as
  `guide:seedance-2.0/<topic>`; `describe_model` returns the router first and only the router
  gates. `tests/agent-corpus.test.cjs` holds every guide entry, sub-skills included, to 30-200
  lines, no placeholder, no em dash, no `$<digit>`. `tests/agent-prompt-budget.test.cjs` holds
  every `docs/agent/**/*.md` to 200 lines and bans dates, names and incident stories in
  `docs/agent/*.md` only, with a comment naming this card as the start of the guides' heal.
- No price anywhere in a guide: the estimate card is the one home for cost. The current guide
  carries relative cost prose ("the dearest model that is not a Veo", "at this price",
  "the bill was larger than expected"); that goes too, not only `$` figures.
- Procedure: `/create-enhancer-recipe`, Phase 0 (vendor skill) run as a Phase 5 heal: inventory,
  classify against the current recipe text, edit, re-sweep. **No in-house production shot any
  mode**, so every row is `vendor` or `inferred` and both modes hand back as "no field evidence".

### Decisions taken at planning (from code and the playbooks, not open questions)

1. **`i2v` writes for the frame the app sends.** Drop the `@tag` asset block and set
   `acceptsMedia: ['image']`. The director skill's reference control and `@tag` rules are scoped
   to a multi-reference surface Vision does not send yet; they go into `sources.md` as the
   recorded starting point for MPI-910, which widens the mode when it wires the references.
2. **The vendor notation replaces ours in both modes** (skill Phase 5 step 5): its section order,
   its cut notation, its single-take default. Whether section names are literal labels in the
   output is settled by the vendor's own worked examples, not by taste. *Superseded by the
   official guide, see Plan Drift: the vendor is ByteDance, its notation is formula prose plus
   `Shot N:`.*
3. **`wordBudget` is added to both modes.** The vendor states no number, so it is sized from the
   word counts of the vendor's worked examples (counts recorded, text not), and step 6 tests it.
4. **Guide split:** router + five sub-skills, each 30-200 lines, in our own words:
   `blocking` (first frame, spatial blocking, gaze and body orientation, landmark proximity),
   `optics` (field of view in degrees, lens choice by content, camera and handheld, lens
   consistency across cuts), `light-and-physics` (lighting as a lock, light direction, physics),
   `performance` (the ACTING skill: eye life, states not transitions, listening, voice, plus the
   director's dialogue timing), `shots-and-cuts` (single take vs multi-shot, cut types, action
   timing, continuity). No `references` sub-skill until MPI-910 ships the inputs it would teach.
   The router says which sub-skill to read for what; the agent cannot guess.
5. **Keep the guides clean by test, not by promise.** Widen the date/name/story ban in
   `tests/agent-prompt-budget.test.cjs` to all of `docs/agent/models/`, minus a named list of the
   eight guides still dated today (chroma, illustrious, krea-2, ltx-2.3, minimax-h3, pony, sdxl,
   wan-2.2). Each later heal deletes its line from that list.

## Implementation

- [x] **Research and inventory.** Re-run Phase 0: the top two community skills by stars
  (`dexhunter/seedance2-skill`, `songguoxs/seedance-prompt-skill`, re-query the counts),
  `krea-ai/skills` `seedance-2.md` (recorded, never read), and a web search for an official
  ByteDance or BytePlus Seedance 2.0 prompt guide (the open flag in `sources.md`; one found
  outranks Higgsfield). Write the numbered rule inventory from the director and ACTING skills
  (heading + line, paraphrased) into `validation.md`, then the classification table against the
  current recipe text for both modes, with the confirms rows. Harvest before editing:
  `sources.md` rows for every source read, adopted and rejected with a reason (2.5 builder and
  LIRA included), and the MPI-910 reference notes. **Verify:** every inventory number appears in
  the table; every `confirms` quote is found verbatim in the recipe.
- [x] **Recipe edit.** Every `contradicts` and `new` row becomes an edit or a written reason, in
  both modes: structure order, notation, vocabulary (lens terms become degrees), `dos`/`donts`
  moved with the notation, `forbiddenPatterns` for objectively wrong output (mm lens, the old
  long suffix, invented `@tags` in `i2v`), `wordBudget`, `acceptsMedia`, `notes`, header comment,
  `systemPrompt` stating all four jobs and the budget. Status stays `draft`. **Verify:**
  `node --test tests/recipe-registry.test.cjs` (then full `npm test` before commit) validates it.
- [x] **Stage 1 sweeps.** Each touched mode green twice on the final text:
  `npm run recipe:test -- seedance-2.0 --mode <t2v|i2v> --engine dolphin3-abliterated --judge gemma-3-12b --runs 3`,
  wrapped in `gpu_lease.py run` as a background call, never through `tee`. Two modes, so four
  clean sweeps plus iteration, about 7 minutes each. Too weak a rung: climb playbook 05 and
  record it. **Verify:** exit 0 on each of the four, logged in `validation.md`.
- [x] **Guide folder.** Rewrite `docs/agent/models/seedance-2.0.md` as the router (pick it when,
  settings the app actually sends, the core shape per op, the sub-skill map, failures that point
  into sub-skills; no cost prose, no card ids, no dates) and write the five sub-skills. Update the
  playbook 08 survey row (Seedance 2.0 read and merged, the 2.5 builder filed under 2.5). Widen
  the ban test. **Verify:** `node --test tests/agent-corpus.test.cjs tests/agent-prompt-budget.test.cjs`
  green, and `guideIdsByModel()['seedance-2-cloud']` lists the router first then the five topics.
- [x] **Verbatim check, then hand back.** A scratchpad script (never committed) compares every
  file this card changed against the four private sources and fails on any shared run of eight
  or more words (case and whitespace normalised). Put the skill's four heal checks for Fabio on
  the card. **Verify:** script reports zero shared runs.

## Completed

- [x] Research and inventory: 138 rules, 44 classification rows, 32 recipe quotes found
  verbatim at HEAD, full coverage (validation.md). sources.md rows 11-18 + MPI-910 notes;
  research.md "MPI-911 answers".
- [x] Recipe rewrite: both modes `prose`, vendor order, budgets t2v 60-220 / i2v 40-160,
  11 forbidden patterns, `acceptsMedia: ['image']` on i2v. `validateRecipe` clean; the four
  examples pass the harness's own checks.
- [x] Guide folder: router (113 lines) + blocking, optics, light-and-physics, performance,
  shots-and-cuts (66-91 lines). Corpus + budget tests green; router lists first. Ban test
  widened to every agent doc minus the eight dated guides; bite-tested. Playbook 08 updated.
- [x] Verbatim check (scratch `verbatim.py`): 0 shared 8-grams across the 14 changed files on
  the final text; 6-grams left are technical terms only.
- [x] Stage 1 on the enhancer of record: t2v I + J and i2v I + J, each 15/15 on the final text,
  outputs read by eye (validation.md 6, iterations 1-14). Probe of the on-request path 4/4.
  Full `npm test`: 1863 of 1866 pass; the one failure is a peer's uncommitted MPI-906 gallery
  file, and the other two are skipped or todo.

## Remaining Work

- None in this card. Next: `mpi-end-session` (commit by pathspec, push, close on the evidence in
  validation.md). Stage 2 renders are Fabio's (DeepInfra, billed); the recipe stays `draft`.
  Proposed rule additions for `.claude/rules/engine-recipes.md` await his yes (validation.md 4).

## Plan Drift

- 2026-09-24, research step: **an official ByteDance guide exists** (BytePlus ModelArk
  "Dreamina Seedance 2.0 series prompt guide", docs.byteplus.com/en/docs/ModelArk/2222480,
  updated 2026-09-22, read in the browser pane: WebFetch sees it empty). Per this plan it
  outranks the director skill where they conflict, which changes decision 2: the output is the
  vendor's formula in prose (subject, action, scene, lighting, camera, style, quality,
  constraints), cuts as `Shot 1: / Shot 2:` with NO second-precise timestamps (the vendor calls
  them unstable, which also rejects the director's `0:00 to 0:03` blocks), dialogue `{}`, sound
  effects `<>`, music `()`. The director's uppercase section labels are a Higgsfield convention
  the vendor does not document; they are not adopted. Everything the vendor is silent on comes
  from the director and ACTING skills: FOV in degrees, first-frame / blocking / gaze / landmark
  locks, lighting as a lock, physics, performance. `outputFormat` becomes `prose` in both modes.
  The top two community skills (dexhunter 3,926 stars, songguoxs 2,842) both teach `0-3s`
  segments; rejected on the vendor's statement.
- 2026-09-24, sweeps: the plan's `--engine dolphin3-abliterated` came from the skill doc and is
  stale. `services/llmEngines.mjs` names `gemma-4-abliterated-12b` the ENHANCER OF RECORD
  ("every v1 recipe is Stage 1 green on this model"), and playbook 05 measured word-cap
  adherence as an 8B-to-12B capability threshold. Dolphin sweeps (3 full, 2 tier) are kept as
  wording evidence (they surfaced the label copying, the eight-variations misread, the invented
  cuts); the twice-green count runs on `gemma-4-abliterated-12b`, judge `gemma-3-12b`.

## Verification

**Verify mode:** auto

The agent self-verifies: the recipe validates in `npm test`; both modes are Stage 1 green twice
on the final text; the corpus and budget tests pass with the folder in place; the router lists
first in `describe_model`; the verbatim check finds zero shared eight-word runs. Stage 2 (real
renders on DeepInfra, billed) is Fabio's and runs after this card; the recipe stays `draft`
until he flips it. The four heal checks go on the card for his review, not as a gate:
notation moved in both modes, rules stated in passing are rows, every `confirms` quote is really
in the recipe, and the vendor's later sections are in the inventory.

## Preservation Notes

- A generalisable lesson may be proposed for `.claude/rules/engine-recipes.md` (a serving
  platform's production-built skill outranks community posts; a skill's frontmatter names its
  model version, read it first). A rule edit needs Fabio's explicit yes.
- MPI-910 inherits the reference notes in `sources.md` and widens `i2v` (`acceptsMedia`, the
  `@tag` jobs, a `references` sub-skill) when the inputs exist.
- `seedance-1.5` shares the old blog sources; not touched here. A heal of it is a separate card.
- Files this card will own: `js/data/recipes/seedance-2.0.recipe.js`,
  `docs/recipes/research/seedance-2.0/{sources,research}.md`, `docs/agent/models/seedance-2.0.md`,
  `docs/agent/models/seedance-2.0/*.md`, `docs/recipes/playbook/08-vendor-prompt-skills.md`,
  `tests/agent-prompt-budget.test.cjs`, `.agents/mpi-kanban/tasks/MPI-911/`.
