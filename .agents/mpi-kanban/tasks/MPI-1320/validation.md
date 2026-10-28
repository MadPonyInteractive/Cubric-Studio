# MPI-1320 validation

- Code: 2705f81ae (pushed to master). CI `tests.yml` run 40763577509: success.
- `npm test`: 3790 pass, 0 fail. Lint clean (pre-commit + pre-push).
- Desktop: `flow-queue-hotkey.spec.js` now asserts the gallery dock — open on Q, no slide-over,
  top equals the agent panel's top (84 px in-window), gallery right edge equals dock left, toolbar
  toggle lit/unlit; Q over a Flow still opens the slide-over on top (MPI-822). `queue-flash` and
  `scene-queue-hotkey` pass unchanged.
- Screenshots (1280×800): dock alone and dock + agent panel; topbar controls uncovered.
- Fabio, 2026-10-28: "Looks freaking fabulastic."
- Known, not fixed: at ~1280 px with both panels open the prompt bar overflows into the dock (the
  agent panel alone already does this on a narrow window).
