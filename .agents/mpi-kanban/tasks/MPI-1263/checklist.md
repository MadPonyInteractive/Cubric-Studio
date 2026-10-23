# MPI-1263 checklist

- [x] Global `~/.claude/CLAUDE.md` memory list back to pointers (25 KB -> ~5 KB), each cut detail confirmed in its topic file
- [x] Project memory sorted: codebase facts moved to docs/rules, copies deleted, `MEMORY.md` trimmed
- [x] Dead `events` key dropped from `board.json` (text edit, no JSON round-trip)
- [x] Unused skills removed: comfyui-api, comfyui-workflow-builder (both mirrors + skills-lock.json), context-audit
- [x] Duplicate `/mpic-component-audit` wrapper removed (`mpi-component-audit` skill stays)
- [x] Old worktrees deleted (`.claude/worktrees/peaceful-hawking-cf139e`, `D:/tmp/cv-720`, `C:/AI/Mpi/Cubric-Vision-1.4.x`)
- [x] mpi-kanban plugin slimming handed to its own session
- [x] `npm run lint` + `npm test` green before push
