# MPI-1217 Checklist

- [x] Local gate in .husky/pre-push: lint + unit on the pushed commit, in a throwaway worktree
- [x] Docs-only pushes skip it
- [x] Proven: red refused, green passes, docs instant, no leftovers
- [x] docs/red-master.md: the gate in the "two gates" table
- [ ] Pushed through the gate itself; CI green on the code commit
