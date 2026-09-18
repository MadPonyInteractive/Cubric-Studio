# MPI-805 — Restart engine button in Settings

MPI-800 dropped the `POST /mpi/reload-extra-paths` call (MpiNodes 1.2.13 removed the route), so
adding a model folder now asks for an engine restart instead of applying live. The only restart
control in the app was the dev-only Ctrl+Tab radial, so a shipped user was told to do something
the UI does not offer.

**Shipped** in `e925c9fc` (CI success): an `engine:restart` event wired to the existing
`_restartEngine`, a **Restart engine** button at the end of External Connections, and the
model-folder toast naming it.

**Status:** `doing` / `validating`, attention required. `**Verify mode:** user-ux` — the point is a
control a user can find and press, so the one thing left is Fabio's own check in the app:

1. change a model folder, press **Restart engine**, confirm the engine comes back;
2. press it once mid-generation, confirm the existing refusal toast.

Automated checks are done (`npm test` + `test:desktop` green in CI on `e925c9fc`;
`lint:components` clean at close-out, 2026-09-18) — see `validation.md`.
