# MPI-1263 checklist

- [ ] Global `~/.claude/CLAUDE.md` memory list back to pointers (25 KB -> ~5 KB), each cut detail confirmed in its topic file
- [ ] Project memory sorted: codebase facts moved to docs/rules, copies deleted, `MEMORY.md` trimmed
- [ ] Dead `events` key dropped from `board.json` (text edit, no JSON round-trip)
- [ ] Unused skills removed: comfyui-api, comfyui-workflow-builder (both mirrors + skills-lock.json), context-audit
- [ ] Duplicate `/mpic-component-audit` wrapper removed (`mpi-component-audit` skill stays)
- [ ] Old worktrees deleted (`.claude/worktrees/peaceful-hawking-cf139e`, `D:/tmp/cv-720`, `C:/AI/Mpi/Cubric-Vision-1.4.x`)
- [ ] mpi-kanban plugin slimming handed to its own session
- [ ] `npm run lint` + `npm test` green before push
