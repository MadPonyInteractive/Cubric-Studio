# MPI-862 validation

## What shipped

`js/components/Compounds/MpiGalleryGrid/MpiGalleryGrid.css`, two commits:

- `69ea666b` - a marked card's mark button keeps the chip background (it was `transparent`,
  so the dot / square / triangle glyph floated bare on the media and vanished on bright frames).
- `fe92c9dc` - the mark button is a compact 26px chip in both states. Round 1 inherited the
  full `sm` button box (42 x 34), which Fabio called "way too big".

**Correction (claim auditor, 2026-09-20):** the `fe92c9dc` commit body says "42x32". That
height was never measured - round 1 only measured the width. `--control-h-sm` is 34px
(`styles/01_base.css:182`) and the untouched reuse button, same box, measures 42 x 34 below.
The commit is pushed on a shared master, so the message stands and the right number lives here.

## Evidence

Static page served over http with the REAL `01_base.css`, `MpiGalleryGrid.css` and
`MpiButton.css` (button sheet loaded last, the worst-case cascade order), button mounted with
the classes the app mounts it with, `getComputedStyle` + `getBoundingClientRect`:

| button | background | glyph colour | padding | size |
|---|---|---|---|---|
| mark, marked | `oklch(0.34 0.022 350 / 0.72)` | `oklch(0.78 0.028 80)` = `--accent-heat` | 4px | 26 x 26 |
| mark, unmarked (hover) | same | `oklch(0.98 0.008 80)` | 4px | 26 x 26 |
| reuse (untouched) | same | `oklch(0.98 0.008 80)` | 8px 12px | 42 x 34 |

Before: the marked state computed `transparent` for background and border.

No spec asserts the mark button's size - `tests/desktop/gallery-filter-panel.spec.js` only
clicks it and reads its icon.

## Human check

Fabio, 2026-09-20, after reloading his own app on the round-2 CSS: "It looks good."

## CI

Run 35541378310 on `fe92c9dc`: `completed` / `success` (read with `gh run view`, 2026-09-20).
The card closes in a separate, board-only commit after that run (`.husky/pre-push`, MPI-819).

## Release notes

None owed. Card marks first appear in `docs/releases/UNRELEASED.md` (v1.5.0 is the latest
release and has no marks), so no released build ever showed the bare glyph.
