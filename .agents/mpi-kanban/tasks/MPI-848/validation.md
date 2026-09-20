# MPI-848 Validation

## What changed

`js/shell/navigation.js` — the radial's `models` leg emitted `models:open` (the Model
Library, an INSTALL surface). It now sweeps overlays and emits `ui:open-model-picker`,
the same event the prompt box's model button fires, so Tab -> Models SELECTS a model.
`models:open` survives as the zero-install fallback, where an empty picker would be a
dead end and the Library is the only useful answer.

The `if (qs('.mpi-model-library')) return;` early-out went with it: from inside the
Library, picking Models now closes it and opens the picker.

## Evidence

`npx playwright test --config=playwright.desktop.config.js tests/desktop/radial-menu.spec.js`
-> **6 passed (22.1s)**, 2026-09-20. The leg's assertion changed from
`.mpi-model-library` visible to `.mpi-model-picker` visible **plus**
`.mpi-model-library` count 0; the test pins one model usable
(`pinOneModelInstalled`) because a dev box has weights and a CI runner has none, which
would otherwise decide which branch of the leg runs.

`npx eslint js/shell/navigation.js tests/desktop/radial-menu.spec.js` -> exit 0.
`node --test tests/tab-flip-target.test.cjs` -> 3 passed.

CI on the fix commit `70943555`: **success** (2026-09-20T11:08:21Z).

Fabio, 2026-09-20: "I already tested the routing, and it's working."

## Closed out

- `.claude/rules/component-events-primitives.md` line 102 said the Models leg emits
  `models:open`, not the picker. Corrected with Fabio's explicit permission (2026-09-20);
  `docs/shell.md`'s "Models took the slot" now names the picker too.
