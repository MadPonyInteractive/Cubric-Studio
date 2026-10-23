# MPI-1263 validation

Measured baseline (last 300 sessions): ~99k-token floor on the first request, median 112 requests per
session, 7.8B cache-read tokens. Files we control are re-sent on every request.

| Change | Before | After | Proof |
|---|---|---|---|
| `~/.claude/CLAUDE.md` memory list | 26,993 B | 12,980 B | every cut detail grepped in its topic file (`hookcheck.py`); same 37 topic files indexed (diff of path sets) |
| project `MEMORY.md` | 16,089 B | 5,777 B | `swapmem.py`: 0 pointers missing, 0 dangling; research + history lines moved verbatim to `research-index.md` / `history-index.md` |
| repo skills listed every request | 19 + `/mpic-component-audit` | 16 | commit `223dc7558` (comfyui-api, comfyui-workflow-builder in both mirrors + `skills-lock.json`, context-audit, the wrapper command) |
| `board.json` | 356,486 B | ~12 KB | top-level `events` dropped as a text edit; `json.loads` equality asserted on the rest; `validate_board.py` passed |
| memory -> docs | 22 files | archived | 14 duplicated docs (spot-checked), 6 moved in `3f92ddd94`, 2 stale; was→now rows in `procedures-index.md` |
| old worktrees | 3 (1.2 GB inside the repo) | 0 | `git worktree list` shows master only; every commit reachable from master or a tag before removal |

`npm run lint` + `npm test`: green in the pre-push gate on `223dc7558`. Docs commit skipped the gate (docs-only).
Kept on purpose: child-safety decision memories (doc has mechanics, not the "never loosen" decision),
`feedback_engine_split_sweep_all_consumers` (linked from `.claude/rules/root-cause.md`), the raw-workflow
preference, `feedback_ollama_needs_the_gpu_lease` (target `docs/agent-chat.md` is claimed by a live peer).
Plugin skill slimming runs in its own session in the mpi-kanban repo.
