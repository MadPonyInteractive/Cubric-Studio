# MPI-742 validation

## Seen in a running app — 2026-09-30 (session dd0e0b12)

Isolated instance `:51518`: own profile, empty `CUBRIC_ENGINE_ROOT`, empty `CUBRIC_MODELS_ROOT`,
own `APP_DOCUMENTS` (Landing: "No projects yet", models 0/21). Driven in the Claude browser pane.

A no-engine app refuses the Flow Library by design (MPI-856), and a real engine root with an empty
models root arms a ~1.5 GB boot repair. So `state.runpodConfig.skipLocalEngine` was set false in the
page after boot: `hasNoEngine()` case 1, and nothing listens to that key. The tile and drawer do
not read the engine.

Read off the DOM:

| Step | Tile | Drawer footer |
|---|---|---|
| Library opened, untouched (slot resolves to LTX) | `Extend Video GET MODELS` | `INSTALL MODELS` |
| MiniMax H3 picked in the drawer | `Extend Video LICENCE REQUIRED` (at once, no reopen) | `REVIEW LICENCE` |
| Review licence → gate → Cancel | `LICENCE REQUIRED`, no toast, gate gone | `REVIEW LICENCE` |

Licence field: `MiniMax H3 Community License Agreement` · `Powered by MiniMax H3` · Read the
licence · Request authorization · Report misuse on our Discord.

- [x] Fabio's eyes, 2026-09-30: "Yeah, it looks good." He also opened the H3 gate himself in the pane; the instance was stopped before any install

## CI

Tests run 36691311222 on `4b4b8960b` (contains `850a823b6`): success, unit + desktop 1-4. Closed 2026-09-30.
