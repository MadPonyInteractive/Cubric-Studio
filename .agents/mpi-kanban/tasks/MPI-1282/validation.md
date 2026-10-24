# MPI-1282 validation

Shipped in `30252792e` (code) + `04d7a433a` (board), pushed through the pre-push gate (lint + unit green).

- `node --test tests/gallery-filter.test.cjs tests/asset-kinds.test.cjs`: 27/27, incl. the new MPI-1282 case.
- `tests/desktop/gallery-filter-stacks.spec.js` (new, isolated app): no Stacks row before a stack exists; after
  stacking two of three cards the row lists, ON shows only the stack and FILTER reads `Filtered: Stacks`, OFF
  brings the loose card back.
- Regression: `gallery-filter-panel`, `gallery-stack`, `media-picker-cards` desktop specs, 7/7.

Verified by Fabio in-app.

Fabio, 2026-10-24: "Looks good and tested in-app." (screenshot: Stacks ON shows only the stack, FILTER dot lit, status reads Filtered: Stacks).
