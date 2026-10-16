# MPI-1162 Validation

## Automated (2026-10-16)

- `node --test tests/entry-info.test.cjs` — 6/6 pass (field set, no seed, Imported/Recorded, Flow title, video size line, m:ss, empty rows dropped, gen-time format).
- `npm test` — 3382 pass, 0 fail, 2 skipped.
- `npx eslint` on all touched JS — clean (incl. the same-tier import rule: MpiEntryInfo is a Primitive so both Compound hosts may import it).

## Live check in `app:isolated` (port 50414, copy of "Cartoon Lizard" in scratchpad)

- Gallery: hover a card → flyout opens left of it with MiniMax H3 / Text to Video / 1m 46s / 448 × 832 · 4s · 24 fps / date / prompt / folded negative. Leaving → closed. Quick sweep across three cards → never opened.
- History: hover the row → flyout opens left of the row with the same entry. Moving into the flyout keeps it open; leaving it closes it.
- Gallery instance torn down on navigation (one `.mpi-entry-info` in the DOM after opening History).
- Bug found and fixed during the check: gallery cards live in `.mpi-gallery-grid__row-wrap[data-group-id]`, not `__card-wrap`; lookup now uses `closest('[data-group-id]')`.

## Fabio eye test (2026-10-16)

- "Looks good." One change asked: drop resolution (already on the History row / gallery card) and call the operation row "Operation". Done: Size row removed, "Made with" -> "Operation"; `node --test tests/entry-info.test.cjs` 5/5 pass, eslint clean.
- Second change asked: History only, no gallery flyout. Removed the gallery wiring (MpiGalleryGrid keeps only the shared `flowModelLabel` / `formatGenTime` imports). eslint clean; entry-info + gallery suites 38/38 pass.
