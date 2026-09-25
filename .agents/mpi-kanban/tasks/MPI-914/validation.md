# MPI-914 validation

## Agent-verified

- `modelQuote(model)` in `js/data/modelConstants/deepinfraPricing.js` is the Model Library tile's
  `_paidQuote` logic, moved verbatim: image = `per image`, fixed-length clip (Veo) = `per clip`,
  other clips quoted at 5 s / 1080p = `per 5s at 1080p`.
- `MpiModelPicker._tileItem`: a cloud tile's state row is now the same
  `mpi-tile__chip mpi-tile__chip--paid[--paid-video]` span the library uses; the meta line gains
  the unit (`CLOUD · PER IMAGE`). Local tiles unchanged. The picker CSS has no chip/state
  override, so the chip renders from `MpiTileSheet.css` exactly as on the library tile.
- `node --test tests/model-picker-cloud.test.cjs tests/paid-models-section.test.cjs
  tests/deepinfra-pricing.test.cjs` → 53 pass, 0 fail. New tests: the picker imports
  `modelQuote` and never `estimateCost`; every cloud model yields `about $…` + a `per …` unit;
  Veo 3.1 quotes `about $3.20 per clip`.
- `npx eslint` on both source files → clean.

## Fabio-verified (2026-09-25)

- Picker cloud tiles checked live with a key saved: "looks good". Follow-up `ce0e0549` drops the
  `CLOUD ·` meta prefix in the picker (corner badge already says it) so `PER 5S AT 1080P` fits
  one line and clip tiles keep their row height.
- CI: Tests #1281 green on `364c24b0`, which contains `6ad20095` and `ce0e0549`.

## Follow-up: one quote, two surfaces (2026-09-25)

- `MpiModelManager.js` `_paidQuote` + `VIDEO_QUOTE` deleted; `_paidPriceText`, the drawer price
  line and the tile meta call `modelQuote`. `estimateCost` import dropped, `PRICES_CHECKED_ON` kept.
  Done after the MPI-908 session (which held the file) closed; its claim record is still
  `claimed` and was left for Fabio to release.
- Proof the Library tiles are unchanged: `{text, unit}` for all 15 cloud models snapshotted from
  the old `_paidQuote` logic BEFORE the edit and from `modelQuote` after — byte-identical, 15/15
  priced.
- `node --test tests/paid-models-section.test.cjs tests/model-picker-cloud.test.cjs` → 22 pass;
  eslint clean.
