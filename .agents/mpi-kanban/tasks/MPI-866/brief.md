# MPI-866 — A red master has no owner once the session that caused it ends

Fabio, 2026-09-21, after losing most of a day: *"the whole day is blocked on this. We have a
bunch of agents waiting."*

## What actually happened, in order

1. `f31d7377` (MPI-831 phase 4) added an advert tile per unbought paid Flow.
   `tests/desktop/flow-library-filters.spec.js` still counted only the installable registry,
   so it asserted 15 tiles against 13 and master went red. `305c6b54` was the last green.
2. **That session (`978b71ce`) closed minutes later.** Nobody was left holding the failure.
3. Master stayed red for about **eight hours**, overnight.
4. `.husky/pre-push` correctly refused every push to master for that whole window. Four more
   commits inherited the red before anyone met it, and the spec was finally fixed in
   `ea154779` by a session working on something else entirely.

Every piece of machinery did its job. The hook blocked, and it even blamed correctly. What is
missing is that **nothing owns a red master between the push that causes it and the next agent
who happens to walk into it.**

## This is the fourth recurrence

`docs/red-master.md` exists precisely because this keeps happening (MPI-818, MPI-819, and the
memory note records three prior occurrences before today). A playbook shortens the fix once
someone notices. It does nothing about the hours before anyone notices, which is the part that
cost the day.

## What is NOT the problem, already checked

- **Concurrency is already correct.** `.github/workflows/tests.yml:30-42` already gives a
  master push a group of ONE via `github.run_id`, so every trunk commit gets its own verdict
  and a red cannot land on the wrong commit. That was MPI-676, and the measured evidence is in
  the comment. Do not re-open it.
- **The pre-push gate is not too strict.** Refusing to push onto a red master is the right
  behaviour and it is what stopped four more agents building on a broken trunk.
- **Blame attribution works.** The hook prints the first red run and its log command.

## Options worth costing, none of them decided

1. **A scheduled watcher.** Something that checks master's last completed run on a cadence and
   raises loudly when it has been `failure` for more than N minutes, rather than waiting for a
   human to try to push. Cheapest thing that would have caught this overnight.
2. **Close-out refuses to leave a red behind.** `mpi-end-session` already knows the session's
   own commits; it could refuse to close while a run on one of them is red or unjudged, which
   would have kept MPI-831's session on the hook instead of letting it end. Note the existing
   related rule in `.agents/mpi-kanban/close-out.md` about not closing a card on a red run of
   its own commit, and see
   [[tool_pre_push_blocks_a_card_closing_on_an_unjudged_commit]] for the trap next door.
3. **A notification to Fabio** when master goes red, so the decision to stop and fix is his
   rather than discovered hours later by whoever pushes next.

Pick one; all three together would be over-building for a problem whose cost is "somebody
notices sooner".

## Verify

Whatever ships, the test is a replay of today: master goes red at commit A, the causing session
ends, and the failure is surfaced to a human or an agent **without anyone attempting a push**.
