# MPI-862 checklist

- [x] Marked card's mark button wears the chip background (same tokens as the Notes marker)
- [x] Glyph keeps its accent colour; unmarked hover state unchanged
- [x] Button does not change size when a card is marked / unmarked
- [x] Computed style proven on a static page with the real stylesheets
- [x] Commit 69ea666b pushed (the agent's push was refused by the permission classifier; Fabio pushed)
- [x] Round 2: Fabio found the 42x34 chip "way too big" - the mark is now a 26px chip in both states (fe92c9dc)
- [x] Commit fe92c9dc pushed (by the agent, once Fabio said "you can push")
- [x] CI green on fe92c9dc (run 35541378310, `success`), then close the card in a SEPARATE commit
- [x] Fabio looked at it in the app: "It looks good."

## Round 2 evidence (2026-09-20)

Same static page, button mounted as the app mounts it (`mpi-btn--sm`):

| button | padding | size |
|---|---|---|
| mark, marked | 4px | 26 x 26 |
| mark, unmarked (hover) | 4px | 26 x 26 |
| reuse (untouched) | 8px 12px | 42 x 34 |

## Evidence (2026-09-20)

Static page, real `01_base.css` + `MpiGalleryGrid.css` + `MpiButton.css` (button sheet loaded
LAST, the worst-case cascade order), `getComputedStyle` on the mark button:

| state | background | glyph colour | padding-left | width |
|---|---|---|---|---|
| marked | `oklch(0.34 0.022 350 / 0.72)` | `oklch(0.78 0.028 80)` (= `--accent-heat`) | 12px | 42px |
| unmarked | `oklch(0.34 0.022 350 / 0.72)` | `oklch(0.98 0.008 80)` | 12px | 42px |

Before the change the marked state computed `transparent` for both background and border.
