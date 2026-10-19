# MPI-1204 validation

**Verify mode:** auto.

## Fix

`routes/engine.js` `_oneEngineJob(kind, res, run)`: `/engine/download`, `/engine/repair-deps` and
`/engine/upgrade` share one in-flight slot. A call while any of them runs logs a warn, answers
`{ success: true, status: 'already-running', running: '<kind>' }` and starts nothing; the running
job's SSE `engine:complete` / `engine:error` reaches every listener, so the modal that re-POSTed
attaches. Different kinds share the slot too: all three rewrite the same engine tree, and the
repair route already hands off to the full download on an unstamped engine. No frontend caller
reads the POST's body (`MpiEngineInstall.js` fires and listens on SSE), so the new status needs no
UI change. `/engine/repair-python-deps` is synchronous (removes a marker, stops the engine) and
stays outside the slot.

## Evidence (2026-10-19)

- `node --test tests/engine-job-single-flight.test.cjs`: 3/3 pass - three overlapping calls (two
  upgrades + a repair) run ONE job and the other two answer `already-running`; the slot frees after
  a throw; each of the three routes goes through `_oneEngineJob` (source check, same shape as
  MPI-1206's).
- `npm test`: 3429 tests, 3427 pass, 0 fail, 2 skipped.
- CI: Tests run 39325692120 green on 3fc798583 (the code commit).
