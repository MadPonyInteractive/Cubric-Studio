# MPI-761 plan - port the MPI-367 Inpaint/Detail help onto the 1.4.2 release line

Compact plan. Scope and reasoning: `brief.md`.

## Current State

Work runs in the release-line worktree `C:/AI/Mpi/Cubric-Vision-1.4.x` (branch `1.4.2`,
started at `a9f3a85b` = `origin/1.4.2`). The card lives on master's board; master code is
untouched.

2026-09-15: DONE. `fb7ee5cf` on `1.4.2`, pushed. Card closed on master. The fix reaches users
with the next 1.5.x cut from `1.4.2` (its UNRELEASED.md carries the Fixes bullet).

## Implementation

Ownership: `../Cubric-Vision-1.4.x/js/data/commandRegistry.js`,
`../Cubric-Vision-1.4.x/tests/op-strip-availability.test.cjs`,
`../Cubric-Vision-1.4.x/docs/releases/UNRELEASED.md`

1. Port `c7493555`'s `commandRegistry.js` hunks by hand: Detail comment + first body line;
   Inpaint header comment, `info`, help comment, `body`, `examples`, `promptRequired: true`
   + comment. Leave 1.4.2's `components` block (already post-fix wording + `krea2Turbo`).
2. Port the `op-strip-availability` test hunk verbatim.
3. `UNRELEASED.md`: Gate-0 note + one `## Fixes` bullet, no em dashes.

## Verification

**Verify mode:** auto

- `npm test` in the worktree passes.
- `grep -c "can NOT see"` on the worktree registry is 0.

## Plan Drift

- 2026-09-15: cherry-pick not usable - 1.4.2 already carries the post-fix `components`
  comment from the MPI-706 port, so that hunk conflicts. Hand port.

## Completed

- Implementation, verification (npm test 674/0, release:check, claim audit 18/18), `fb7ee5cf`
  on `1.4.2`, pushed.

## Remaining Work

- None on this card.
