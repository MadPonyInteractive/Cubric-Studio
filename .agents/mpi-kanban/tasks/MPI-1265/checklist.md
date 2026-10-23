# MPI-1265 checklist

- [x] `task_ops.py archive --all-done` run on plugin 1.7.1
- [x] Board validates, `--fix` leaves archived cards off the board
- [x] Commit carries only the archive's own edits (no peer hunks in board.json / events.jsonl, no peer research files)
