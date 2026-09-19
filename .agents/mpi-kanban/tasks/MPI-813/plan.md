# MPI-813 — plan

## Current State

Session 2026-09-19. **Shipped and verified** — see `validation.md`. The brief's "mechanism unknown" turned out to be un-investigable
and, more usefully, **moot**: `tests/helpers/scratch.cjs` was never committed. It is in
no commit, no stash, and not on disk (`git log --all -- tests/helpers/scratch.cjs` is
empty; `git log --all -S'cubric-tests'` hits only the three MPI-810/812 board commits).
The failing code no longer exists, so there is nothing to root-cause — only a helper to
write correctly the first time.

**And the brief's stated condition is disproven.** "gif-frames leaves some on-disk state
that breaks a later gif-make, only once they share a parent directory" — the six fixtures
ALREADY shared a parent before the change: `%TEMP%`. Re-pointing `TEMP`/`TMP` at an empty
scratch root and running `gif-frames` then `gif-make` under `--test-concurrency=1`:

```
node --test --test-concurrency=1 tests/gif-frames.test.cjs tests/gif-make.test.cjs
  -> 13 pass, 0 fail
```

A shared parent is not the trigger. The trigger was something in the helper itself.

## Approach

Copy the pattern the repo already proved in `tests/helpers/sandbox-roots.cjs`: an
eagerly-created root plus a synchronous `process.on('exit')` sweep. Two deliberate
differences from the backed-out attempt:

1. **Per-process subdirectory** — `<tmp>/cubric-tests/<pid>/`. Restores the isolation the
   flat layout had by accident (the brief's own "worth checking first"), and still leaves
   one directory to `rm` after a crash.
2. **No async cleanup, nothing deferred.** `ensureDirSync` at module load, `rmSync` at
   exit. A floating promise that removes a directory a test is still using is the most
   plausible shape for the unexplained failure; this design cannot have it.

## Completed

- `tests/helpers/scratch.cjs` — `scratchDir` / `scratchDirSync` / `scratchPath`.
- All 9 call sites moved across 6 files; the orphaned `node:os` require dropped from each.
- Verified: 13/0 on the pair that failed, 45/0 on the six together, 1351/0 on `npm test`,
  and 0 litter — including on a run that throws. Evidence in `validation.md`.

## Remaining Work

Nothing for this card. Shipped, verified by the commands in `validation.md`, closed.

**Committed but NOT pushed.** `.husky/pre-push` blocked it: master'''s last completed CI
run is red, and the failure is not this card'''s — `npm test` passes in CI, and the one
failing spec is `tests/desktop/gif-cutout.spec.js:739` ("Pick shows its label (MpiButton
drops `label` without an icon)"), whose files have uncommitted edits sitting in this
shared tree right now. Not our fix, so no `--no-verify`. Push once master is green.

## Verification

**Verify mode:** auto

1. `node --test` on the six files together, and `gif-frames` + `gif-make` at
   `--test-concurrency=1` (the exact pair that failed before).
2. Count `%TEMP%` entries matching the six prefixes before and after a run — must not grow.
3. Full `npm test` to prove nothing else consumed those fixtures.

## Plan Drift

- 2026-09-19 — brief said "find what gif-frames leaves behind". Dropped: the premise is
  disproven (above) and the code that failed is unrecoverable. Rebuilt instead.
