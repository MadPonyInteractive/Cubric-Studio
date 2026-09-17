# MPI-785 plan

Shipped in `e93bbf18` (card marks + the shared FILTER in the media picker). Component maps
refreshed after Fabio approved it (2026-09-17). Open work is Fabio's look-and-feel feedback
from 2026-09-17, below.

## Current State (2026-09-17, session 66b73298)

DONE. Fabio approved the second look (2026-09-17); closed by mpi-end-session. The feedback round:
- Measured the hold: menu in the DOM at 408 ms with the timer at 400, fully drawn the same
  frame. The app adds no delay (the popup mounts already active, so no fade plays). Both
  suspects below are cleared. `MARK_HOLD_MS` is now 250 (measured 257 / 258 ms).
- The spec now pins it: menu in the DOM under `MARK_HOLD_MS + 250`, drawn within 100 ms
  of mounting (checked: an injected 300 ms entrance animation turns it red, 318 ms).
- `mark_*` icons doubled: dot r=10, square 18x18, ring 11/7.5; triangle 22 wide rather than
  24, because the full 24 read heavier than the dot and square.
- Next: Fabio looks again. On approval, close with mpi-end-session. If the hold still feels
  slow in his REAL gallery, the timer is not the cause (measured); suspect main-thread load
  from his card count and videos, which no isolated run reproduces.

## Fabio's feedback (2026-09-17), done above

1. **The hold is too slow.** `MARK_HOLD_MS` is 400 ms (`js/components/Compounds/MpiGalleryGrid/cardMarkMenu.js`),
   but it "feels more like 1.5 seconds". Make it faster.
   - Measure first: time from pointerdown to the menu being visible, in a desktop spec step
     (the gallery spec already holds the button, `tests/desktop/gallery-filter-panel.spec.js`).
     If it is far above the timer, something else adds the delay. Suspects, not verified: the
     MpiPopup entrance (`transition: all var(--t-fast)` from `opacity: 0` plus a translate,
     `MpiPopup.css`), and the fav-wrap hover-reveal transform (`MpiGalleryGrid.css`
     `.mpi-group-card__fav-wrap`).
   - Then lower the timer (for example 250 ms) and let Fabio feel it again.
2. **The shapes should be about twice as big.** They read as hard to notice. Today the
   `mark_*` paths in `js/utils/icons.js` are drawn small inside the 24 box (dot r=5, square
   9x9, triangle 12 wide) and render in an 18 px `sm` icon, so the dot is about 7.5 px.
   Doubling means dot r=10, square 18x18, triangle about 20-24 wide. Also check the picker's
   `.mpi-media-picker__mark` chip and the filter panel row icons still look right.
   - The gallery spec asserts the drawn path strings (`DOT`, `TRIANGLE` constants): update them.
3. Re-run `node --test tests/gallery-filter.test.cjs tests/asset-kinds.test.cjs` and the two desktop
   specs (`--output=test-results/mpi785`), then ask Fabio to look again before closing.

## Known, not this card

- Saves stall 5-15 s behind the Projects landing page's preview videos. Follow-up task
  `task_b327e4e8` is running in its own session; the gallery spec's `SAVE_WAIT` (30 s) goes
  once that lands.
- `galleryFilterPanel.css` is not in `js/shell/preloadStyles.js` (a peer held that file).
  It loads through both hosts' `css:` lists. Add it to the manifest if the file is free.
