# MPI-960 validation

2026-09-28 — `npx playwright test --config=playwright.desktop.config.js tests/desktop/colour-pick-eyedropper.spec.js`: 1 passed.
The spec mounts Remove Background (Color mode), Paint and Paint Adjust against a stub viewer
with `window.EyeDropper` stubbed, clicks each Pick, and asserts the swatch reads the picked
hex and that Paint + Adjust hand it to `viewer.el.setPaintColor`. No page errors.
Screenshot reviewed: Pick sits right of the swatch in all three panels, same button as the
GIF cut-out's.

`npx eslint` on the three organisms: clean. `node --test tests/paint-adjust.test.cjs`: 16/16.

Remaining: Fabio's look in the real app (real screen pick, workspace accent colours).

Fabio, 2026-09-28: "Yeah, that works." Shipped in b10d94ef3.
