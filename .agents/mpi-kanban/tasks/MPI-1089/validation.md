# MPI-1089 validation

## Automated (2026-10-11) - passed

- `node --test tests/flow-chain.test.cjs tests/flow-legs.test.cjs`: 29/29. New: head-removed pick -> the version
  before it; with-head, unknown file, nothing-before-it and a flow with no toggle leg go in as given.
- Every test importing flowService: 247/247.
- Fabio's real project (`Qwen 2.1`, hydrated from sidecars, scratchpad `real1089.mjs`):
  `flowCharacterSheet_012` -> `flowCSE_010`, `flowCharacterSheet_014` -> `flowCSE_012`, `flowCSE_012` unchanged.

## Left: Fabio's eye test

Reload the app. Character Sheet Editor, pick a card showing its head-removed version, Headless front body on,
any change. Expect: version 1 has a head (the edit matched a real face), version 2 removes it once, hair intact.

## Fabio passed (2026-10-11)

Accessories run (wizard staff) on a head-removed pick: version 1 with head (flowCSE_013), version 2 head removed once (flowCharacterSheet_015), hair intact. "Yeah, that worked nicely."
