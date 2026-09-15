# Heal dry run — the clean-room brief (MPI-677 step 4c)

**v2 (2026-09-14, runs 6a–6c).** v1 ran runs 1–5 the same day (committed at `6c6b1a46`; grading
in `../validation.md` § "Step 4c"). Five single runs on five wordings did not converge, so v2
changes the TEST, not the wording (Fabio, option 2): the classification table goes to its own
file with no length cap, three runs go in parallel on one wording, each into its own folder, and
a pass is a pattern across the three (see the pass bar). Everything else is v1, verbatim.

## Stage the inputs first (the orchestrating session does this)

1. Pick a fresh folder in YOUR session scratchpad — call it `<SCRATCH>` below — and create
   `<SCRATCH>/heal-dryrun/`, plus one empty output folder per run: `run-a/`, `run-b/`, `run-c/`.
2. Copy `research/heal-dryrun-card.md` to `<SCRATCH>/heal-dryrun/heal-card.md`.
3. `git -C C:/AI/Mpi/Cubric-Prompt show 02215cc:src/main/recipes/minimax-h3.recipe.ts >
   <SCRATCH>/heal-dryrun/premerge-minimax-h3.recipe.ts` (669 lines). Write the path out literally —
   `guard-claim` blocks an unexpanded `$VAR`.
4. The findings doc is read in place; it has not changed since `81c6bec` (2026-08-15), so it is
   exactly what the hand merge read. Re-check with
   `git -C C:/AI/Mpi/MadPony-Identity log -1 --format=%h -- production/cubric-western/findings/h3-prompting.md`.
5. Dispatch THREE `general-purpose` agents in parallel, in the background, with the prompt below —
   `<SCRATCH>` replaced by the literal path and `<RUN>` by `run-a`, `run-b`, `run-c`, nothing else
   changed. Do not add hints from the answer key.

## The prompt

You are testing a written procedure by following it cold. This is a STATIC DRY RUN: you read and
reason, you produce a report, you change nothing.

### The procedure
Follow **Phase 5 — Heal** (and the Phase 0 it calls) in
`C:\AI\Mpi\Cubric-Vision\.agents\skills\create-enhancer-recipe\SKILL.md`, as far as step 5
(proposing the recipe edits) and the step 6 budget statement. Follow its wording exactly — the
wording is what is being tested. Its reasoning doc is
`C:\AI\Mpi\Cubric-Vision\docs\recipes\playbook\09-field-evidence.md`; the vendor-skill method is
`C:\AI\Mpi\Cubric-Vision\docs\recipes\playbook\08-vendor-prompt-skills.md`.

### Your inputs (the ONLY things you may read)
- The heal card: `<SCRATCH>\heal-dryrun\heal-card.md`
- The recipe as it stands (treat it as CURRENT): `<SCRATCH>\heal-dryrun\premerge-minimax-h3.recipe.ts`
- The findings doc (1,854 lines — read ALL of it, in chunks):
  `C:\AI\Mpi\MadPony-Identity\production\cubric-western\findings\h3-prompting.md`
- The three procedure files named above.
- For Phase 0 only: the vendor's public GitHub repo `MiniMax-AI/MiniMax-H3`, read with `gh api`
  (list the tree first; dotfolders count). Read-only.

### FORBIDDEN — reading any of these invalidates the test
They contain the answer this dry run is graded against:
- `C:\AI\Mpi\Cubric-Vision\js\data\recipes\minimax-h3.recipe.js` (and any other file under
  `js/data/recipes/`)
- anything under `C:\AI\Mpi\Cubric-Vision\docs\recipes\research\`
- `C:\AI\Mpi\Cubric-Vision\.claude\rules\engine-recipes.md`
- anything under `C:\AI\Mpi\Cubric-Prompt\` (files, kanban cards, git history)
- anything under `C:\AI\Mpi\Cubric-Vision\.agents\mpi-kanban\`
- any other file under `<SCRATCH>` besides the two inputs above and your own two output files
  (other runs are writing next to you — never open another `run-*` folder)
- any `~/.claude` memory file
- `git log` / `git show` / `git blame` in ANY repo
- do not grep the Cubric-Vision repo for "western", "h3" or "minimax".
If you find yourself needing one of these, stop and say so in the report instead.

### Hard constraints
- Write NOTHING in any repo. The only files you may create are `<SCRATCH>\heal-dryrun\<RUN>\result.md`
  and `<SCRATCH>\heal-dryrun\<RUN>\table.md`.
- No test harness, no `npm`, no LLM calls, no GPU, no app, no network except the `gh api` reads
  above.
- Never touch http://localhost:3000 or any running app.
- **Every row in the classification table and every proposed edit MUST cite its evidence: a
  findings section heading AND line number, or a vendor file path.** An edit supported only by the
  vendor must be labelled `basis: vendor` — never dressed up as measured. A claim with no citation
  does not go in.

Project conventions you must respect (from the repo's CLAUDE.md, Critical Rules Snapshot, abridged
to what applies to a read-only task): never take the user's app on :3000; recipes ship
`status: 'draft'` and only Fabio flips `validated`; never render.

> **ROOT-CAUSE RULE — no exceptions.** Never symptom-patch. A guard clause, special case, try/catch
> or timeout at the crash site that makes the error disappear without touching the cause is a
> FALSE DONE and will be rejected. (1) Trace the failure to its origin — if you cannot explain WHY
> it happens, you have not found it. (2) Read the subsystem doc before changing the design; the
> correct fix usually already has a home the buggy code bypassed. (3) Touching a shared primitive
> means grepping EVERY call site and fixing all of them in one pass — and dual-engine code means
> fixing BOTH the local and remote twins. (4) If the real fix needs a refactor, STOP and report it
> rather than shipping the band-aid. (5) Verify at every affected call site, not just the reported
> symptom.

(Applied here: a proposed recipe edit must address the rule in the recipe that CAUSES the
contradicted behaviour, not add a ban on its symptom.)

### Write `result.md` with exactly these sections
1. **Scope** — the production's mode(s), stated once, plus any `model`-scoped facts (Phase 5 step 1).
2. **Phase 0 and the vendor diff** — what the vendor repo holds; the diff of the vendor's documented
   format against the recipe for every mode the recipe declares (step 2); what you would adopt,
   reject, and why.
3. **Classification table** — the step 3 table, fed by BOTH sources, confirmations included, written
   to `<SCRATCH>\heal-dryrun\<RUN>\table.md` with NO length cap. In `result.md` give only its row
   count and the findings sections you walked.
4. **Proposed recipe edits, in order** — for each: what changes in the recipe (name the
   const/field/mode), which mode(s), basis, citation, FORMAT or CONTENT. Every `contradicts`/`new`
   row must map to an edit or a written reason for not making it. Mark any edit to a mode the
   production did not shoot and say what it rests on.
5. **Harvest list** — what you would write to the card / research docs / propose as a rule before
   editing (step 4). Do not write them.
6. **Sweep budget** — modes touched and sweeps owed (step 6).
7. **Files read** — every path you opened, and every `gh api` call. Be exact; this is how the test
   is checked for contamination.
8. **Procedure gaps** — anywhere Phase 5 was ambiguous, missing a step, or pushed you toward a
   mistake.

Keep `result.md` (not `table.md`) under ~240 lines. When done, reply with a 5-line summary: number
of table rows, number of contradictions, number of proposed edits, modes touched and sweeps owed,
and whether you had to stop on any forbidden file.

## Pass bar (for the grader, not the agent)

Against MPI-27's six changes (`../validation.md` § "Step 4c"): finds 2, 3, 4 and 6 with the right
mode and basis; applies the `model`-scoped budget and the vendor-backed notation and sound fields
to t2v/i2v, not r2v alone; finds 1 (`[Shot N]`) through the vendor diff, with 5 (the bans it
retires) following; claims no t2v/i2v change as measured; harvests before editing; budgets sweeps
per mode; files-read list clean.

**v2 — the pattern across runs 6a–6c, fixed BEFORE dispatch.** PASS = every one of the six changes
meets the bar above in at least 2 of the 3 runs, AND no run proposes an edit that breaks a
measured rule, AND no run defers a row on a misread citation or an unquoted "decision of Fabio's",
AND every files-read list is clean. Diagnosis for each change on a miss: found in 1 of 3 = the
wording cannot hold it reliably; found in 0 of 3 = a wording or structure gap, the case for a
separate rule-inventory pass before classification (option 3).
