# MPI-893 Validation

Every claim below was run, not reasoned about.

## Board

- `validate_board.py .` at start: **17 violations, all in `state/`**. Board itself clean.
- Counted independently: 277 cards (83 todo / 17 doing / 177 done), `next_id` 893 = max 892 + 1,
  no duplicate ids, every board entry has a `task.json`, every `maturity` in the fixed enum and
  column-coherent, no `column` mismatch between card and board, root `events.jsonl` 4910 lines
  **0 unparseable**, only extra folder is `_archived`.
- After the refresh: **4 violations**, all four the deliberately-left peer claims below.

## The state index

`validate_board.py . --fix` rebuilds the five derived arrays from each record's status on
disk. Verified it is status-driven, not heartbeat-driven, by reading `INDEX_ARRAYS` in the
script before running it — that is what makes it safe for dormant sessions.

| array | before | after |
|---|---|---|
| `active_sessions` | 10 | 15 |
| `active_file_claims` | 6 | 7 |
| `pending_file_states` | 280 | 294 |
| `open_messages` | 41 | 39 |
| `active_handoffs` | 38 | 35 |

`index.json` backed up to the session scratchpad before the first `--fix`.

## The five stuck claims — how each was decided

Dumped every record and resolved its `owner_session` and `task_card`.

- **`11acd4e1` → RELEASED.** Card MPI-858 is `done` / `complete`; `git status --short` on its
  four claimed paths is clean (only an untracked `validation.md`, a card artefact). Owner
  `0d099d28` closed 2026-09-20. Release event appended to the record.
- **`243e6d57`, `c25c427c`, `cb64609a` → LEFT.** One session `6b5a38e3`, task record
  `8decf633` = MPI-888 (`doing` / `validating`, updated today). Holds `services/agentLoop.mjs`,
  `docs/agent/masking.md`, `tests/agent-loop.test.cjs`.
- **`d1ba816b` → LEFT.** Session `a7f5566f`, MPI-887. Its ten claimed paths match the dirty
  working tree **exactly** — that is the evidence the work is live.

Both surviving owner sessions carry `heartbeat_at: 2026-09-22T09:49:02Z` — the **same
instant**, so a bulk close, not two sessions ending independently. Both also carry
`active_file_claims: []` while their claim records name them as owner, so those claims
protect nothing on the session side. One message sent to each.

## Rules and config

- `diff` of `.claude/rules/behaviour.md` against
  `<pack>/skills/mpi-lib/templates/behaviour-rules.md`: **byte-identical**, verified after the edit.
- Briefing config re-parsed from the frontmatter: **21 listed rules, 21 resolve on disk,
  21 carry a `## Sub-Agent Briefing`**. The only file with a briefing still unlisted is
  `README.md`, which is the index and deliberately excluded.
- `.claude/settings.json` re-parsed after the matcher edit: all 8 top-level keys intact,
  3 `Stop` hooks, 1 `PreToolUse` entry, `git diff --stat` = 1 line changed.
- `guard-shell-backticks.py` **fired live** during this refresh and blocked a `python -c`
  with backticks — the project hook is working, and 1.5.0's `guard-shell.py` does not cover
  that shape (read its docstring: heredocs, backslash-continuations, PowerShell `@"` only).

## Profile and index

- Both frontmatters re-parsed with `yaml.safe_load` after the note rotation — **parse OK**.
- Index pointer sweep over every `**Read first:** / **Rules:** / **Docs:** / **Memory:**`
  line: **104 checked, 0 unresolved.**
- Suspected-dead pointers chased individually and all confirmed live:
  `docs/playbooks/bump-engine/01-smoke-run.md`, `~/.claude/memory/tools/sharp.md`,
  `c:\AI\Mpi\CubricStudio_Redesign\`. The one genuinely dead name
  (`tool_read_download_state_without_console.md`) appears only inside a historical refresh
  note and as prose explaining where it went, not as a pointer.

## The stray

`state/commit-msg-5d913141.txt` deleted — but only after confirming its commit had landed:
`git log --grep` finds it as **`f70b4c84`** `feat(MPI-817): the agent makes GIFs...`.
Nothing was lost.

## Commit

`c645d95c`, 23 files, by explicit `--only` file pathspec. `git status --short` run **after**
the commit per the rule this card restored: the only leftovers under `.agents/` are four
peers' paths (MPI-706, MPI-730, MPI-858, MPI-887), none of them mine, none swept in.

## What this card did NOT do, and why

Fabio corrected the premise mid-refresh: every session in his sidebar is active even after
weeks idle. A stale heartbeat is therefore not a dead session. Dropped as a result:

- the newest-wins handoff prune (27 open handoffs left in place — they are resume paths);
- any prune of `active_tasks` (MPI-623 at 494 h, MPI-591 at 335 h, both still in `doing`);
- resolving any of the 30 open peer messages.

Not pushed — the commit is local. Awaiting the user's word.
