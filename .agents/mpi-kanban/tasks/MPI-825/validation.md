# MPI-825 — validation

## The defect

Five MPI-771 events were written in a pre-schema shape, into both the global
`events.jsonl` and `tasks/MPI-771/events.jsonl` — ten lines, all committed:

```json
{"at": "…", "event": "checklist.updated", "actor": "implementer:7bbff4d4", "task": "MPI-771", "note": "…"}
```

against the schema's

```json
{"schema": "mpi-kanban/event/v1", "type": "…", "id": "MPI-771", "at": "…", "actor": "…", "summary": "…"}
```

`validate_board.py` reported **26 violations**, so every board write in this session
printed `Board validation FAILED` — six times — and the real signal was buried.

🔴 **`validate_board.py --fix` does NOT repair these.** The hint `task_ops` prints on the
failure points at it, but `--fix` is deliberately narrow (its own docstring: "It does not
touch maturities, columns, links or claims") and only re-homes orphaned task folders.
Running it on this failure does nothing, which is a trap worth knowing before the next
person follows the hint.

## The repair

Field renames only — `event`→`type`, `task`→`id`, `note`→`summary`, plus the `schema`
key. `at`, `actor` and the note TEXT are carried over verbatim: these are another
session's log records and the point is to make them readable, not to restate them.
`note`→`summary` is included because `_schema.md`'s own example uses `summary` and
nothing reads `note` — the text was invisible to every reader.

The predicate is exactly `validate_board.py`'s four checks, with the `id` requirement
gated on being inside a task folder (`require_task_id`). That gate matters: the first
run of the repair used "missing id" unconditionally and rewrote **45** historic global
events that were never violations. Caught on the diff (9224 lines changed), reverted
from `HEAD`, and the script now takes `--task` for the folder case.

Each line keeps its own line ending, so the diff is the repaired lines and nothing else.

## Evidence

```
.agents\mpi-kanban\events.jsonl: 5 repaired of 4630
.agents\mpi-kanban\tasks\MPI-771\events.jsonl: 5 repaired of 34
```

```
 .agents/mpi-kanban/events.jsonl               | 10 +++++-----
 .agents/mpi-kanban/tasks/MPI-771/events.jsonl | 10 +++++-----
 2 files changed, 10 insertions(+), 10 deletions(-)
```

```
$ python validate_board.py .
Board validation passed.
VALIDATOR_EXIT=0
```

Resting state on this board is 0 violations again, as `.claude/rules/kanban.md` says it
should be.
