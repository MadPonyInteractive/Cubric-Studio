# MPI-1217 Checklist

- [x] Local gate in .husky/pre-push: lint + unit on the pushed commit, in a throwaway worktree
- [x] Docs-only pushes skip it
- [x] Proven: red refused, green passes, docs instant, no leftovers
- [x] docs/red-master.md: the gate in the "two gates" table
- [x] Pushed through the gate itself (68 s, green); CI run 39522176981 green on 4fdfc625
