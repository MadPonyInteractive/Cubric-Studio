# MPI-825 — checklist

- [x] All ten malformed lines repaired to `mpi-kanban/event/v1` (global + card folder)
- [x] Field renames only — `at`, `actor` and the note TEXT carried over verbatim
- [x] Predicate is exactly `validate_board.py`'s checks, with the `id` check gated on being inside a task folder
- [x] Each line keeps its own ending, so the diff is 10 lines and nothing else
- [x] `validate_board.py .` → `Board validation passed`, exit 0
- [x] Recorded that `--fix` does NOT repair these, despite the hint `task_ops` prints on the failure
