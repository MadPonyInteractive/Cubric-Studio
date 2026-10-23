# MPI-1265 validation

- `task_ops.py archive --all-done` (mpi-kanban 1.7.1): "Archived 565 card(s) in place; folders kept".
- Board after: todo 74, doing 10 (live cards untouched), done 0. `board.json` 12 KB -> 1.7 KB.
- `validate_board.py --fix` then passed and did NOT put the archived cards back (done stayed 0); its
  only repair was the gitignored session index.
- 565 `task.json` + 565 task `events.jsonl` changed; no other card file. Six done cards had other
  sessions' uncommitted files (MPI-1141 `files.json`, research outputs in MPI-1156/1180/1232/1243/1249);
  none was a `task.json` or `events.jsonl`, so the commit takes only the archive's edits.
- Commit built from HEAD through a temp index: board = HEAD minus the archived ids (a peer's uncommitted
  MPI-1262 move stays out), global log = HEAD plus this archive's lines only.
- Folders stay under `tasks/<id>/`, so the 95 tracked docs/code files linking into them still resolve.
