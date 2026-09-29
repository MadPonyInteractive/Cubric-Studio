# MPI-978 validation

## Root cause

Every `project:group-updated` reaches the grid through `el.refreshGroup`, which repainted the
card in place and never re-ran the filter predicate. The card's own mark button (and the in-app
agent's `card.mark` tool, via `markGroup`) take that path; only the selection bar called
`_rerenderJustified('mark')`, so only it removed a card that stopped matching.

## Fix

`f1f35317d` - `refreshGroup` compares "is the card rendered" with `_passesFilter(group, sort)`
(the render's own predicate, now one helper) and re-packs only when they disagree. Covers a mark,
archive or selected-item change from any caller.

## Evidence

- `tests/desktop/gallery-filter-panel.spec.js` new step "un-marking a card under a mark filter
  drops it from the gallery": Squares filter on, un-mark `vid2`, gallery must empty.
  - With the re-pack disabled: FAILED (3 cards still rendered).
  - With the fix: passed.
- `gallery-archive.spec.js` (3), `gallery-stack.spec.js`, `gallery-filter-panel.spec.js`: 5/5 passed.
- `tests/gallery-filter.test.cjs`: passed.
- CI on `f1f35317d`: green, run 36561697863 (unit + 4 desktop shards).
- Fabio verified live (2026-09-29): un-marking a card under a Dots filter drops it.

## Release notes

None: card marks (MPI-785) are unreleased and already in `docs/releases/UNRELEASED.md`.
