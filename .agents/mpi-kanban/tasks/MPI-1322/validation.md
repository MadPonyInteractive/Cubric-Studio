# MPI-1322 validation

- Cause, from the MPI-1320 session transcript: its close-out ran `cat .agents/mpi-kanban/close-out.md | head -60`; the changelog step started at line 79. Across past close-out transcripts the file was read with `head -60` (51 times) or `head -80` (52 times), almost never whole.
- Second cause: the step was a `Your call:` line written only on a yes; close-out does not wait, so an archived session left it unwritten.
- Fix (2100b35de's parent commit): the release-notes block is now the first step (line 16), the write rule is at line 44, inside a `head -60` read, and the closing agent writes the line and shows it in the report. The intro names this step as the one exception to pointers-only. Outline checked with `grep -n "^#"`.
- Fabio, 2026-10-28: "Yes, fix it."
