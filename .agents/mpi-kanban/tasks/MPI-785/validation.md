# MPI-785 validation

## Agent evidence (2026-09-16)

| Claim | Command | Result |
|---|---|---|
| Filter contract: marks OR together, AND with kinds; legacy `favourite: true` reads as a dot; mark icons exist; `byGalleryOrder` sorts | `node --test tests/gallery-filter.test.cjs tests/asset-kinds.test.cjs` | 22/22 pass |
| The legacy-dot test bites | `markOf` changed to return null for `true`, same command | 1 fail (the markOf test), then reverted |
| Whole Node suite | `npm test` | 1220 tests, 1219 pass, 0 fail |
| Card mark click / hold menu / persisted id / legacy dot; panel rows Dots, Squares, Triangles, Previews; mark filter ANDed with kinds | `npx playwright test --config=playwright.desktop.config.js tests/desktop/gallery-filter-panel.spec.js --output=test-results/mpi785` | pass |
| Media picker: shared FILTER on a local sort, slot preselection, tile marks, panel above the modal, gallery sort untouched | `npx playwright test --config=playwright.desktop.config.js tests/desktop/media-picker-cards.spec.js --output=test-results/mpi785` | 4/4 pass, twice in a row |
| Lint on every changed JS file | `npx eslint <files>` | exit 0 |

## Known, not caused by this card

- The gallery spec's save check needed a 30 s wait. `/update-project` itself takes about
  15 ms. It stalls 5-15 s because the Projects landing page leaves about 15 preview `<video>`s
  mounted behind the gallery, and they hold the renderer's HTTP connections to the app server.
  With those videos unloaded before the click, the same save landed in under a second. Filed as
  a follow-up task. The same stall made two untouched picker tests (audio hover, voice manifest)
  flake once in a combined run. Both passed on two reruns.
- `js/shell/preloadStyles.js` was not touched (a peer's claim), so `galleryFilterPanel.css` loads
  through both hosts' `css:` lists instead of the preload manifest.

## Needs Fabio

- [ ] Look: are the dot, square and triangle the right size and weight on a card?
  2026-09-17: no, "hard to notice"; make them about twice as big.
- [ ] Feel: is a 400 ms hold right for opening the shape menu?
  2026-09-17: no, it "feels more like 1.5 seconds"; make it faster.
