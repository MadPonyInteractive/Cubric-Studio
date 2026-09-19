# MPI-817 — In-app agent reliability (umbrella)

*Created 2026-09-19 on Fabio's instruction, folding MPI-774 and MPI-816 into one job.*

One question runs through both cards: **does the in-app agent do what it is asked, and say so
truthfully when it does not?** Fabio's two review rounds, the global-memory gap and the flow
dispatch bug are all that same question at different layers.

## Members

| Card | Column | State | What it carries |
|---|---|---|---|
| **MPI-774** | `doing` | `validating` | Fabio's round 1 and round 2 findings. Phase 5 is closed (ten fixes; fix 8 closed unreproduced 2026-09-19). **Phases 6 and 7 are open.** |
| **MPI-816** | `todo` | `planned` | Agent-dispatched Flow runs die on `prompt_outputs_failed_validation`. Diagnosed to the line, not built. |

Member cards stay where they are — this umbrella does not close, move or merge them. Which of the
two the board keeps long-term is Fabio's call, asked once below.

## Phases

### Phase A — MPI-816: the agent cannot fill a field it was never described (open)

Plan: `.agents/mpi-kanban/tasks/MPI-816/plan.md` · checklist and validation beside it.

Two independent defects, both located:

- `js/utils/declaredFields.js:500` — a `null` caller value overwrites a declared default.
- `js/shell/agentDispatch.js:488` — `agent.list-models` advertises flow fields as `{id, label}`
  only, so the agent cannot know a field's type, default or legal options.

Closes only on the end-to-end verify: ask the agent, in Fabio's own words, for four character
sheets of four sisters, and **four cards land**.

### Phase B — MPI-774 Phase 6: global memory (open, needs Fabio)

A global agent store beside the per-project one (`<APP_USER_DATA>/agent/`). Design conversation
first; nothing is decided. See `.agents/mpi-kanban/tasks/MPI-774/plan.md` § Phase 6.

### Phase C — MPI-774 Phase 7: agent reliability (open, needs Fabio)

See `.agents/mpi-kanban/tasks/MPI-774/plan.md` § Phase 7. **Phase A is evidence for this phase**,
not a detour from it: a dispatch that fails four times while the agent reports success is exactly
the reliability question Phase 7 exists to answer. The narration bug parked at the end of MPI-816's
plan belongs to whichever of the two Fabio wants it in.

## Parallel Batch — Phase A and Phase B

Disjoint footprints, so these two can run at once. Phases B and C both need Fabio in the room, so
in practice this batch is only worth arming if he is working B while a worker takes A.

**Task A — MPI-816 flow-field dispatch**
Owns:
- `js/utils/declaredFields.js`
- `js/shell/agentDispatch.js`
- `.claude/skills/cubric-vision-flows/SKILL.md`
- `.agents/mpi-kanban/tasks/MPI-816/`
- tests it adds for the above

**Task B — MPI-774 Phase 6 global memory**
Owns:
- the agent store paths under `js/services/` and `routes/` that Phase 6 settles on (NOT yet
  named — the design conversation has not happened, so this footprint is provisional and must be
  fixed before the batch is armed)
- `.agents/mpi-kanban/tasks/MPI-774/`

🔴 **Do not arm this batch while Task B's footprint is still provisional.** A batch whose
ownership is guessed is how two workers land on the same file. Phase C is NOT in the batch: it
overlaps Phase A's files by design.

## Settled: the member cards stay

Fabio, 2026-09-19: **keep MPI-774 and MPI-816 as separate cards.** The condition he attached is the
whole point of this umbrella — *"as long as they get picked up later or are part of the umbrella."*
So this card carries one obligation: **neither member is allowed to go quiet.** If a session closes
without touching them, they are still Phases A-C here, and this plan is where that is visible.

Do not fold, close or merge them without asking him again.
