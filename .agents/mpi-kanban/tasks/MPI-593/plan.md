# MPI-593 Plan: step 1, split the cubric-vision skill

Source: `brief.md` § "The skill split" and § Sequencing (step 1 first, worth doing even if
the CLI never ships). The measured layout came from MPI-677's plan, step 4 bullet "Split
`.claude/skills/cubric-vision/SKILL.md`", which is the umbrella's 4b and points here.

## Current State

**2026-09-15: CARD BACK IN `todo` / `deferred` (Fabio): the CLI is not needed for release 2.0.**
Steps 2 and 3 are NOT started. They wait on the four questions at the bottom of `brief.md`
whenever this card is picked up again.

**Step 1 is DONE, verified, and committed with the MPI-677 handoff.** The router is 108 lines,
plus `projects.md`, `on-disk-format.md`, `generating.md`, `flows.md` and
`engine-and-remote.md`, all ≤200. § Connector was rewritten to match what
`routes/connector.js` serves. Both outside anchors were repointed. Evidence: `validation.md`.

Picked up 2026-09-15 as MPI-677's 4b (Fabio: "go with 4b on MPI-593"). MPI-547, MPI-556 and
MPI-675 are done, so no other card edits `SKILL.md`.

## Step 1: split the skill

`SKILL.md` is 721 lines, over the 200-line budget. Sections move verbatim, by line range:

| File | Takes | Lines (approx) |
|---|---|---|
| `SKILL.md` (router) | frontmatter, Before anything else, Hand over whole prompts, a "where everything else lives" table, Connector, Tests, Docs | ~110 |
| `projects.md` | Projects, Media | ~117 |
| `on-disk-format.md` | The on-disk format, Reference slots are positional | ~186 |
| `generating.md` | Dispatching a generation, plus "Still true: do not POST a graph to `/proxy/prompt`" | ~137 |
| `flows.md` | Running a Flow (and text-to-speech) | ~125 |
| `engine-and-remote.md` | Engine control, RunPod remote engine, System | ~80 |

Also:
- **Rewrite § Connector to what `routes/connector.js` serves.** MPI-677 step 2 deleted
  `/connector/enhance` and the broker capabilities; the section still advertised them.
- Fix the cross-references the split breaks (a "see X" whose X moved to another file).
- Repoint the two outside anchors that name a moved section:
  `.agents/mpi-kanban/project-knowledge-index.md:174` and
  `docs/playbooks/add-flow/06-preview-image.md:139`. `CLAUDE.md:32` names the router path
  and needs no edit.
- Frontmatter `description:` must not change: it is the skill's external selector.

Ownership: `.claude/skills/cubric-vision/**`, `.agents/mpi-kanban/project-knowledge-index.md`,
`docs/playbooks/add-flow/06-preview-image.md`.

## Verification

**Verify mode:** auto

`verify_split.py` (session scratchpad; the command and its output go in `validation.md`):
every file ≤200 lines; frontmatter identical to HEAD; every non-blank HEAD line present in
the new files except the lines deliberately rewritten; every relative link resolves; every
cross-referenced section exists in its file; both outside anchors repointed; the stale
Connector text gone.

## Remaining Work

- Step 2, the CLI. Blocked on `brief.md` § Questions (where it lives, v1 verbs, headless).
- Step 3, ship + discover. Worthless without step 2.

## Plan Drift

- **2026-09-15: five files, not four.** MPI-677's layout had `generating.md` holding both
  dispatch and Flows (~196). MPI-658 and MPI-547 grew both sections, to 125 lines each, so
  together they break the budget. Flows get `flows.md`.
