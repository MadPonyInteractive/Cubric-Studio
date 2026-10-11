# MPI-1087 validation

## Automated (2026-10-11) - passed

- Full unit suite `node --test "tests/**/*.test.cjs"`: 3121 pass, 0 fail.
- Desktop `tests/desktop/flow-chain-toggle.spec.js` (isolated app, port 56520): the LEFT field swaps the card between
  its two versions (pane + selectedIndex + persisted), and no toggle is drawn on the result.
- Lint clean on every changed file.

## What changed

- Head removal (`toggle` leg) runs on every run of Character Sheet, from Images and the Editor; off, it lands with
  `keepSelected` so the card keeps showing the head version. With nothing run before it and the toggle off, nothing runs.
- The left Headless front body field switches the shown result (swap, or run the leg alone on an old result).
- The button drawn on the result is gone.
- Compare-only Flows (Editor, Scribble Object, Object Stamp) get a Compare <-> Result button.

## Pending: UNRELEASED.md lines (file held by peer session e6751fca, MPI-1073)

- **One Headless front body button on the Character Sheet Flows.** Every sheet now comes with both versions, with the head and without, and the Headless front body button beside the settings switches between them. The second button drawn on the result is gone.
- **A Flow that compares the result with your picture can show the result on its own.** The Character Sheet Editor, Scribble Object and Object Stamp opened only in compare, with no way out but dragging the bar. A Compare / Result button now switches.

## Left: Fabio's eye test (all three Character Sheet Flows)
