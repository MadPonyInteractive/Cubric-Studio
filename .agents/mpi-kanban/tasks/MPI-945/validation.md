# MPI-945 validation

Shipped in 7df2f423b.

## Automated (2026-09-27)

- `tests/desktop/gallery-cue-all.spec.js` - selecting 4 cards shows the bar and hides the prompt box;
  Cue all label/disabled/reason follow the LIVE op (t2i: disabled, i2i: `Cue all (3)`); one click queues
  3 jobs in click order, video skipped; the bar closes and the prompt box returns. Marks: Square on
  the bar writes `favourite: "square"` to all 4 cards in `project.json`, lights Square, keeps the
  selection; clear writes `false` to all 4.
- `tests/desktop/delete-offers-archive.spec.js` - context menu order without `cue-all`.
- `gallery-filter-panel.spec.js`, `control-heights.spec.js` green; `npm test` 1995 pass / 0 fail; eslint clean.
- Screenshot checked: bar sits in the prompt box's strip; lit mark fills with the accent; marked
  cards show their chip while selecting.

## Round 2 (Fabio, 2026-09-27): Compare, Combine, Make GIF, Download, Archive, Delete

- Compare, Combine, Make GIF moved OFF the card menu onto the bar; Download, Archive, Delete on
  both. Card menu is now two groups (`delete-offers-archive.spec.js` pins the order).
- `gallery-cue-all.spec.js`: bar action order, each with a status-bar reason, disabled pattern
  on 3 images + 1 video; Archive from the bar writes `archived` to `project.json`, removes the
  cards and ends the selection.
- `gif-make.spec.js` and `gif-cutout.spec.js` build their GIF through the bar (5/5 cutout green).
- `npm test` 1997 pass / 0 fail; eslint clean. Delete is a ghost button (danger filled a solid red block).

## CI

- Round 1 (7df2f423b) judged inside run on 6ee78cb83: green (the red on 7df2f423b itself was
  MPI-944's lint fragment, skipped desktop shards).
- Round 2 (3bb2bc9f7) + rule text (6dd3d893c): run 36279729460 green, unit + 4 desktop shards.

## Verified by Fabio (2026-09-27)

- Tested live: "this looks good". Follow-up idea split to MPI-948 (send a selection to the agent).
- Claim audit: 31 proven; one overstated UNRELEASED line (Cue all skips cards that do not fit
  the op) reworded with Fabio's approval in the close commit.
