# MPI-876 Checklist

Started 2026-09-22. Fabio chose to start against MPI-851's shipped `provider` field rather
than wait for MPI-851's two live checks, which are his alone to run.
Offline half shipped in `d7d153d1`. Evidence: [validation.md](validation.md).

## The quote

- [x] The agent can learn what a generate body will cost BEFORE it fires, from the same
      `estimateRunCost` MPI-852's price tag uses — not a second copy of the arithmetic.
      It must price the RESOLVED run (named params, fitted size), not the raw args.
      → `POST /connector/quote` → `generation.quote` → `_quoteGeneration` in the renderer.
- [x] A local model quotes nothing at all, and nothing about a local run changes.

## The gate

- [x] `agent:confirm` gains `kind: 'spend'`, emitted before the fire, and the turn suspends.
- [x] `_pendingConfirm` carries the price; `confirm()` branches on `pc.kind` and defaults to
      `'install'` for a card left pending across the upgrade.
- [x] `reset()` resolves a pending `spend` card to a REFUSAL, not a truthy string (MPI-870).
      Second defence: `_askSpend` answers `yes === true`, which is what actually bites.
- [x] `GET /agent/history`'s `pendingConfirm` projection carries the new fields, or a reload
      loses the price while Yes still spends. It was dropping the BATCH card's fields too.
- [x] `No` records a decline that does not say "the installation".

## The batch

- [x] Six cloud cards = ONE card quoting the batch figure via `{ batch: N }` — never a
      multiply of `display`, never a second card after the batch card.
- [x] A cloud batch BELOW `BATCH_CONFIRM_ABOVE` still raises the spend card.

## The card copy

- [x] The number is `estimateCost().display` verbatim; the sentence only wraps it.
- [x] `null` still ASKS, and says the cost is not known until it finishes — naming no cause.

## Tests

- [x] `tests/agent-loop.test.cjs` covers: billed op does not dispatch until Yes, local op
      asks nothing, the batch card quotes the batch, null still asks, `reset()` is a NO.
- [x] Proven RED by backing the gate out — nine mutations, each alone. See validation.md.
- [x] `npm test` green: 1783 pass, 0 fail. `tests/agent-no-delete.test.cjs` gained its
      allowlist line for the new route, which is what its own header says to do.

## Open for Fabio — nothing below is closable by an agent

- [ ] One real gated run against a live key; `flux-schnell-cloud` at $0.0005 is the model
      the plan picked for it.
- [ ] The figure on the card checked against the landed sidecar's `generationSettings.cost.usd`.
- [ ] The copy table in plan.md is a draft he has not seen.
- [ ] Whether `POST /connector/generate` itself should refuse an unconsented paid run. The
      absorbed MPI-854 map asks for it; the route's own design note says a CLI agent's user
      is its own gate, and the shipped `cubric-vision-generate` skill takes that path.
      Raised, not decided — nothing shipped here changes that route.
