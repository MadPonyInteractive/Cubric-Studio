# MPI-1264 validation

`CLAUDE.md` 10,179 B -> 8,972 B (~300 tokens off every request in this repo). Light trim: the rest is
load-bearing (Critical Rules Snapshot is pasted into sub-agents; every router and skill row kept).

| Cut from CLAUDE.md | Still reachable at |
|---|---|
| accent-family details + website source line | `DESIGN.md` § The accent family (line 98 names `landing.css:30-34` as source of truth) |
| repeated "two maps route everything" sentence | line 3 of `CLAUDE.md` itself |
| dev and portable `app.log` paths | moved into `docs/DEVELOPMENT.md` § Reading `logs/app.log` (new "Where the file is" paragraph) |
| `test-failed-1.png` first, runner bare disk | `docs/red-master.md` line 33 + causes |
| smoke runner name, `smoke-evidence.json` gate | `docs/playbooks/bump-engine/01-smoke-run.md` |
| pre-push gate mechanics (throwaway worktree, fail-open, close on red) | `docs/red-master.md` § The two gates + line 105; `.agents/mpi-kanban/close-out.md` line 46 |

Docs-only change: no code, so lint/tests not applicable.
