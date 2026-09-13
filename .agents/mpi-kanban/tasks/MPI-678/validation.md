# MPI-678 Validation

**Verify mode:** user-ux — a green suite does not close this card.

## Machine-checkable — ALL PASSED (2026-09-01)

- [x] `npm run lint` — clean
- [x] `npm run lint:components` — clean
- [x] `npm test` — 853 pass / 0 fail
- [x] `npx playwright test --config=playwright.desktop.config.js tests/desktop/gallery-archive.spec.js` — 3/3
      - an archived card leaves the gallery, is reachable under the archive scope, and comes back
      - the context-menu entry is labelled off the card, not the scope
      - `archived` survives the round trip to project.json
- [x] Regression sweep: `flows-tab-ring`, `gallery-renditions`, `gallery-media-release`,
      `workspace-sweep` — 15/15. These cover the project bar, the grid and navigation, the three
      surfaces this card moved things between.

**NOTE the runner.** `npx playwright test tests/desktop/...` without `--config` resolves the
default config, never sets `CUBRIC_PORT`, and looks for a `:3000` window — Fabio's live app. It
fails with `shellWindow: no 127.0.0.1:3000 window within 30000ms`, which reads like a broken
spec and is not. Always pass `--config=playwright.desktop.config.js`.

**Mutation-checked.** Deleting the scope gate (`if (!!g.archived !== wantArchived) return false;`)
fails the first spec at `expect(active).toHaveLength(2)`. The test bites on the real logic rather
than passing on the fixture. Grid restored byte-identical afterwards (verified by `diff`).

## Fabio's eyes — PASSED (2026-09-01)

Fabio tested the built app himself and signed off: *"UI is good. I just tested it. I tested
archive, I tested filtering inside of archive, and tested returning to gallery. All looks great."*

- [x] **The archive scope does not read as data loss.** Archive → the card leaves the grid;
      the scope toggle reaches it; return to gallery brings it back. Confirmed in the app.
- [x] **Filtering inside the archive works.** The design claim — the reason this shipped as a
      scope rather than a seventh filter chip — confirmed by hand, not just by the spec.
- [x] **The re-centred project bar accepted.** Flows sits half a Record button left of true
      centre in the gallery, against the MPI-589 placement, and Record is hidden in
      group-history so Flows returns to dead centre there. Both raised explicitly and accepted.

## Evidence

Every machine leg above run and passing (lint ×2, 853/853 node, 3/3 archive spec, 15/15
regression sweep), the scope gate mutation-checked, and the two `user-ux` items confirmed by
Fabio in the running app. That is the evidence that closes this card.

## Re-verified before commit (2026-09-13)

The work sat uncommitted in the shared tree for twelve days while MPI-723, MPI-730 and MPI-733
committed around it, so the evidence above was re-run against the tree as it stands rather than
trusted:

- [x] `npx eslint` on the ten changed JS files and the spec: clean, exit 0
- [x] `npm test`: 961 pass / 0 fail
- [x] `npx playwright test --config=playwright.desktop.config.js tests/desktop/gallery-archive.spec.js`:
      3/3, on isolated port 55294

Drift since 2026-09-01, none of it blocking:

- MPI-723 moved the ItemGroup build into `mediaImportService`, so the technical reason Record is
  gallery-only is gone. The gate stays as an open product question, and the comments already say so.
- `MpiMediaPicker._collect()`'s archived skip reached HEAD inside MPI-693's `e51c2ea9`, so it is
  not in this card's commit.
- Riding in this card's commit: MPI-723's comment and doc rewrites, which it left for whoever
  commits MPI-678, and a three-line mojibake-dash repair in `routes/projects.js`.
