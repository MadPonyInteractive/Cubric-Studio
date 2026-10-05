# MPI-1022 checklist

- [x] scripts/precommit-done-gate.sh, called first from .husky/pre-commit
- [x] tests/pre-commit-done-gate.test.cjs (throwaway repo, never the shared index)
- [x] docs/red-master.md + close-out.md name the new check; DOCS_RE sync line names three files
- [x] Live check: a real mixed commit in a scratch clone is refused
