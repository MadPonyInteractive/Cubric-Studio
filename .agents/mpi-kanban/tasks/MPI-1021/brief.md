# MPI-1021 Brief

Upstream defect in the Mpi-Kanban plugin, version 1.6.0 (the installed copy and the
`C:/AI/Mpi/Plugins/Mpi-Kanban` source are both at 1.6.0). Found in the MPI-1020 session,
2026-10-05. **File it as an issue on `MadPonyInteractive/mpi-kanban`; never patch the
installed plugin.**

## What happens

Every new session's SessionStart context opens with:

```text
Board file problems (repair: `validate_board.py <root> --fix`):
  .agents/mpi-kanban/state/index.json active_sessions is missing 1 record(s): <this session's id>
```

and the session's first `task_ops.py create` or `move` ends with
`Board validation FAILED. Repair with: python validate_board.py --fix`, even though the card
write itself succeeded. `--fix` clears it (exit 0).

## Why

- `hooks/_mpi.py` `ensure_session()` writes `state/sessions/<session id>.json` with
  `status: active` and deliberately does not touch `index.json` (its docstring: "no index
  write to race another process"; `coordination-ops/lifecycle.md` § Index Rules: the index is
  not the population, `guard-claim` lists the directory).
- `hooks/session-start.py` `main()` calls `ensure_session()` and then `board_errors()`, which
  runs `validate_board`. Its index-completeness check (`validate_board.py`, the
  `"{label} {field} is missing {len(missing)} record(s)"` error, asserted in its own selftest
  as `active_sessions is missing 1`) flags the record the hook wrote a moment earlier.

So the hook reports a problem it created, every session, and the warning trains agents to
ignore the "Board file problems" block.

## Fix options (the pack owner's call)

1. Drop the `active_sessions` completeness check (keep "lists a closed session"), since the
   sessions directory is the population by design.
2. Have `ensure_session()` also add the record to `active_sessions`, with an atomic write that
   cannot race a second window.
