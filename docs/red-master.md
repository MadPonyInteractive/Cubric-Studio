# Master is red — the playbook

**Read this when:** a push is blocked by `.husky/pre-push`, CI on master keeps failing, agents
are pushing `--no-verify`, or Fabio arrives angry that "master is red again". It has happened
repeatedly (2026-08-23, 2026-09-02, 2026-09-18/19). Do not start from zero: the diagnosis is
five commands and the causes are a short, known list.

**It is never the Mpi-Kanban plugin.** The plugin does not run tests or touch CI. The two
gates are this repo's `.husky/pre-push`.

## Diagnose — five commands, in this order

```bash
gh run list --branch master --workflow tests.yml --limit 30 --json conclusion,headSha,displayTitle,databaseId
```
How long has it been red, and which commit was the first red after a green?

```bash
gh run view <id> --log | sed 's/.*Z//' | grep -E '^\s+[0-9]+\) |[0-9]+ (failed|passed|flaky)'
```
The failing specs. **Do this for the first red run AND the newest one** — the set changes. A
red master hides the next break: on 2026-09-19 five specs broken by one card sat unseen for
three runs underneath two older failures.

```bash
git show --stat <first-red-commit>
```
Could that commit touch the failing spec at all? A docs-only commit cannot; that is a flake.

```bash
gh run download <id> -n playwright-results -D <scratchpad>/ci-art
```
**Look at `test-failed-1.png` before theorising.** The 2026-09-19 radial failure was a
"No models installed" dialog sitting over the gallery — visible in one glance, invisible in
the log.

```bash
npx playwright test --config=playwright.desktop.config.js tests/desktop/<spec> --output=<scratchpad>/out
```
Green here and red in CI is an ANSWER, not a dead end — see cause 1.

## The five things that generate the reds

1. **Green locally, red in CI.** The runner has no model weights, no GPU and a fresh
   profile; every dev box has all three. The spec's FIXTURE is wrong, not the product. Fix
   the fixture and PROVOKE the runner's condition inside the spec so it fails locally without
   the fix (`testing-desktop-specs.md`, trap 5). Worked example:
   `tests/desktop/radial-menu.spec.js` — `pinOneModelInstalled` + `provokeNoWeights`.
2. **A big removal that ran only the tests it touched.** MPI-781 deleted two Flows' display
   assets; four desktop specs used those files as fixture media. Before pushing a removal,
   `grep -rn "<deleted name>" tests/`.
3. **A wholesale commit of a file a peer is mid-edit in.** `6da64611` swept another
   session's half-written spec assertions onto master. `.claude/rules/git.md` — pathspec and
   hunk-level commits on this shared tree.
4. **A flake.** A different spec each run, usually an Electron boot timeout. CI retries
   twice (`playwright.desktop.config.js`, `retries: 2` on CI), so a completed `failure` is
   almost never one any more. If it is: `gh run rerun --failed <id>`.
5. **Lint (MPI-833).** `npm run lint` runs on the runner as of 2026-09-19, BEFORE both
   suites, and it lints the whole repo (`eslint .`), not just `js/`. The rule that bites is
   `no-undef` (MPI-832): a rename that leaves one use of the old name behind is a
   `ReferenceError` in the user’s app, and the suite cannot see it — the source-contract
   tests are regexes that never execute the line. Red in seconds rather than twenty
   minutes, and `npm run lint` locally reproduces it exactly.

## The two gates, and what each is for

| gate (both in `.husky/pre-push`) | asks | blocks |
|---|---|---|
| **Done gate** (MPI-819) | did THIS card's code commit bring the red, or is it unjudged? | only the card being moved to `done`. Blames by ancestry + failing spec FILES, so a close during someone else's red passes |
| **Master gate** | did master's last completed run fail? | any code push. Docs / `.agents/` / `.md`-only pushes skip it |

Both fail OPEN (no `gh`, no network, shallow clone) and both yield to `--no-verify`.

## The rules that go with them

- **A red master is the job of whoever meets it.** There is no "not mine": the session that
  broke it is gone. It is usually one spec and under twenty minutes.
- **`--no-verify` pushes the FIX.** It is never a way around the red.
- **A card does not close on a red run of its own commit** (`.agents/mpi-kanban/close-out.md`).
  Code first, `gh run watch`, then the close — the done gate prints the exact
  `git push origin <sha>:master` when they arrive together.
- After fixing: `gh run watch <id>` to green. A fix that has not been watched is a theory.

## If it is STILL happening after all this

Then one of the above is being skipped, or there is a fifth cause. Check, in order: are
agents pushing `--no-verify` without a fix in the push (`git log` between the first red and
now — count the non-docs commits)? Are cards sitting in `doing` with red commits (the done
gate's visible failure mode)? Is the red in the UNIT suite (`npm test`)? — those failures
print no file path, so under an existing red the done gate cannot attribute them.
Evidence and measurements from the 2026-09-19 session: `tasks/MPI-818/validation.md`,
`tasks/MPI-819/validation.md`.
