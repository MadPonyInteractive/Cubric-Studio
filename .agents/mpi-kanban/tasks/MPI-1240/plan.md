# MPI-1240 plan - the test sandbox helper must never adopt (or delete) a real models root

## Cause

`tests/helpers/sandbox-roots.cjs` `set()` kept any already-set `CUBRIC_ENGINE_ROOT` /
`CUBRIC_MODELS_ROOT` ("Already-set values win") and its exit hook `rmSync`s both roots. Since
2026-10-21 `CUBRIC_MODELS_ROOT=M:/CubricModels` is a USER env var (MPI-1227), so every test that
requires the helper without pinning its own root first (`orphan-sweep`, `remote-restart-clears-flag`,
`universal-nodes-drift`) took the real store as its sandbox: ran its sweep there, then deleted it on
exit. Fabio's whole local store went on 2026-10-22 (`npm test` 00:42Z, pre-push 00:45Z, session
"Child-safety gate" fixing MPI-1239). CI never saw it: the runner has no such env var.

## Fix

One rule in the helper (every caller at once): a root is a sandbox only if it sits inside
`os.tmpdir()`. An inherited value outside it is replaced with a fresh temp root, so the exit hook can
only ever delete temp dirs. Tests that pin their own temp root first keep it, as before.

Ownership: `tests/helpers/sandbox-roots.cjs`, `tests/sandbox-roots-hygiene.test.cjs`,
`.agents/mpi-kanban/tasks/MPI-1240/`.

## Verification

**Verify mode:** auto. A child process started with `CUBRIC_MODELS_ROOT` / `CUBRIC_ENGINE_ROOT` on a
non-temp canary dir requires the helper and exits: the canary survives and both roots it reports are
temp dirs. Then lint + the full suite with the user env var live.

## Current State

2026-10-22: fix + regression test written and verified (hygiene test 2/2 pass, lint clean, old
helper proven to delete the canary). Committed in the handoff. Next: watch CI on that commit, then
close the card. Full `npm test` locally was NOT run after the fix (handoff came first); the
pre-push hook ran it in a worktree.

## Completed

- Helper: an inherited root outside `os.tmpdir()` is replaced, never adopted or deleted.
- `tests/sandbox-roots-hygiene.test.cjs`: canary child-process test.

## Remaining Work

CI green on the fix commit -> close. Your call for Fabio: the 3 tests that inherit a root
(`orphan-sweep`, `remote-restart-clears-flag`, `universal-nodes-drift`) are now safe via the helper.

## Plan Drift
