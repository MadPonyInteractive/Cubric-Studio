# MPI-1022 validation

Approved by Fabio at MPI-1020's close-out (2026-10-05). Code commit `8548192d`.

- `tests/pre-commit-done-gate.test.cjs`: 5/5 pass under `sh` (the shell husky uses). Cases: code + done move refused, naming the card and listing only the non-`.agents/` paths to commit alone; the close on its own passes; code with the card in `doing` passes; a `rejected` close beside code passes; concluding a merge passes.
- Mutation check: deleting the MERGE_HEAD skip, or the `rejected` skip, each turns exactly one test red; restored, 5/5.
- End to end, through the real `.husky/_/h` runner in a scratch repo (lint-staged stubbed): a plain `git commit` of code + done move is refused (exit 1); `git commit --only <code>` then succeeds with the card left staged; the close then commits on its own; `git commit --only <code> .agents` (MPI-1020's exact shape) is refused.
- Live in this repo: `8548192d` itself went through the new hook (card in `doing`, so it passed) and lint-staged; no EOL churn after.
- `npm test`: 2719 tests, 0 failures. `eslint` on the new test: clean.
- CI: Tests run 37276424998 on `8548192d` passed, unit and all four desktop shards. The unit job's log shows all five new cases passing on `windows-latest`, so `sh` resolves there and the test runs, not skips.
- This card's own board-only close commit went through the new hook without `--no-verify` and was let through.
- Docs: `docs/red-master.md` (the commit-time check, and the DOCS_RE sync line now names three files) and `.agents/mpi-kanban/close-out.md`. `.claude/rules/git.md` describes the pre-commit hook only for lint-staged, still true, left alone.
