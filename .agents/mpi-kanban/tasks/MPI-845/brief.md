# MPI-845 — chrome defects Fabio reported by eye

Three small CSS defects in the app chrome, all reported live on 2026-09-20 and all with a
measured cause. Built and committed; each one is judged by eye, so the card waits on Fabio.

1. **The titlebar mark** read small and disagreed with the "Cubric Studio" lettering, and it
   moved with screen resolution. `logo.png` is a 256×256 canvas holding 254×174 of art, so a
   16px square box rendered the robot 15.88 × 10.88. Now the unpadded `logo.webp` at
   `height: 14px; width: auto`.
2. **The back chip filled on hover** ("← GALLERY", "← PROJECTS") while Flows and Record beside
   it did not. A specificity loss: the chip's `background: none` is (0,1,0) and MpiButton's
   ghost hover fills at (0,3,0). Overridden at (0,4,0) for the chip and the breadcrumb link.
3. **The reference-image chip's X became a tall rectangle.** MPI-822's
   `min-height: var(--control-h-sm)` clamps the used height after the cascade, so the pill's
   `height: 16px` could not win at any specificity — it rendered 16 × 34. **Five** call sites
   had the same defect, not one; all released with `min-height: 0`.

`MpiButton.css` is deliberately untouched by all three: its ghost fill and its size floor are
both correct for every other button in the app.

Two new tests guard 2 and 3, both proven red against the pre-fix code. Detail and evidence:
`plan.md`, `validation.md`.
