# MPI-1189 plan - Dev tooling

Umbrella, Fabio 2026-10-18 (board tidy). Work on the tools around the app (agent guards, the
Mpi-Kanban plugin, the dev box), never shipped to users.
**A menu, not a sequence:** pick any row; work happens on the member card.

**Umbrella rule:** every member's `description` starts with
`UMBRELLA: MPI-1189 - Dev tooling. Menu: tasks/MPI-1189/plan.md.`

## The menu

| Card | Job | Touches | Blocked on |
|---|---|---|---|
| MPI-659 | guard-gpu misses script-wrapped dispatches and non-Comfy GPU jobs | Mpi-Kanban plugin `gpu_command_patterns` (sibling repo) | Nothing |
| MPI-1021 | The SessionStart hook flags its own session record as missing from `active_sessions` | Mpi-Kanban plugin, upstream issue | Nothing; still fires on 1.6.2 (2026-10-18) |
| MPI-511 | Dev-box CPU floor: VS Code watcher excludes + Defender exclusions | `Cubric-Vision.code-workspace`, an admin PowerShell | Fabio runs the admin step |

## Parallel Batch

MPI-659 and MPI-1021 both live in the plugin repo: one after the other. MPI-511 is independent.
