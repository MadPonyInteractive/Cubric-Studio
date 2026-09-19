# MPI-819 Validation

## The gate, against real history

`tests/pre-push-done-gate.test.cjs` - 7/7. The git half is real (MPI-811's close `250d9da4`,
code commit `034d1d52`, predecessor run on `bf266123`); only the two `gh` calls are fixtures.

| case | result |
|---|---|
| MPI-811 as it happened: new failing spec under an older red | refused, names `radial-menu.spec.js`, does NOT blame it for `gif-cutout` |
| someone else's red, same spec set before and after | passes |
| any green run carrying the commit | passes |
| green before, red on the first run carrying it | refused |
| run in flight | refused, `gh run watch <id>` |
| code and close in one push | refused, hands over `git push origin <sha>:master` |
| no runs (no gh / network) | fails open |

`bash -n` and `sh -n` clean - husky 9 runs hooks under `sh -e`, so no process substitution.

## Live, real `gh`

- MPI-818's close (`759d7636`) replayed through the real hook: passes (green run 35429283095
  carries `39631f23`).
- **This card's own close (`6f684891`), pushed while its run was in flight - refused:**
  `[pre-push] BLOCKED - MPI-819 moves to done, and CI has not judged its code commit bcd8e60e.`
  `gh run watch 35430544748`. Watched to green, pushed again, passed.

## Limits, stated

- `--no-verify` bypasses it, like every hook. It removes the easy exit; it cannot weld the door.
- A session can still walk away with the card in `doing`. That is visible on the board, which a
  false `done` was not.
- Blame is by failing spec FILE. A peer's commit in the same multi-commit push can be blamed
  on the card that closes first; whoever meets it fixes it, which is the MPI-818 rule anyway.
- Unit-test (`node --test`) failures print no file path in the failed log, so under an existing
  red they cannot be attributed and pass. Under a green predecessor they still block.

## CI on the shipping commit

`bcd8e60e` -> run 35430544748: **success**. The gate's own tests skip there (shallow clone), as designed;
they ran 7/7 on the dev box, which is the only place the hook runs.
