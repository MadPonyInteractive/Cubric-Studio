# MPI-855 Validation

**Verify mode:** `user-ux`.

## 2026-09-24 — Remote panel readout, offline

- `tests/deepinfra-account.test.cjs`: drives the real `GET /deepinfra/account` with the probed
  `/payment/checklist` shape plus marker strings in the address, card and email fields. Asserts the
  answer is four named numbers (spentUsd 2.90, balanceUsd 1.54, limitRoomUsd 2.10, limitUsd 5) and that no marker,
  `line1`, `postal_code`, `last4`, `name` or `email` reaches the response or any `logger.*`
  call, on success, on a 500 with a body, and on a thrown fetch. **Proved red** (3/1) with the route
  answering `...checklist` wholesale; green restored.
- `npm test` 1862 pass, 0 fail. `lint:components` clean.

## 2026-09-24 — per-session Cosmo readout, offline

MPI-903 closed (`f41548bf`) and released agentLoop/agentDispatch; message `ce29cf5a` resolved.
- `agentLoop.mjs`: `_spend = { chatUsd, genUsd }` via `_addSpend`; chat += `usage.estimated_cost`
  on every loop reply and the compaction handoff call; gen += `output.costUsd`; zeroed on
  `reset()`; in `getHistory()` and emitted as `agent:spend`. Not counted: the `look` describer
  (returns no usage).
- `agentDispatch._reportDone`: `costUsd` = sum of `generationSettings.cost.usd` over `items`
  (a native batch reports ONCE with every card, each carrying its share), else the one item.
- `tests/agent-loop.test.cjs` "session spend (MPI-855)": two replies at 0.002 + 0.003 and a
  $1.90 clip give chat 0.005 / gen 1.9, the last `agent:spend` matches, reset zeroes; a reply
  with no `estimated_cost` adds nothing. **Proved red** with the gen sum removed (0/1) and with
  the chat sum removed (0/1); green restored.
- `npm test` 1863 pass. Two reds, neither this card's: MPI-867's declared todo, and
  `gallery-card-teardown.test.cjs`, which reads a PEER's uncommitted `MpiGalleryGrid.js`
  (dirty in the tree with an untracked `gallery-generating-mascot.spec.js`).
  `lint:components` clean.

## Outstanding — Fabio in the app (restart first; server + renderer changed)

1. Settings > Remote connection > Check spend: the figures against the dashboard.
2. A Cosmo conversation: one question, then one cloud generation. The header reads
   `Chat $0.0x · Generations $y` with the two apart; Start over clears it.

## 2026-09-24 — LIVE PASS (Fabio, screenshots)

1. **Check spend** read "Spent $3.48 this month · $10.96 of credit left · $1.52 of your $5.00
   monthly limit left"; the dashboard at the same moment: PREPAID CREDITS $10.96, MONTHLY USAGE
   $3.48 / $5.00. All three to the cent (after a $10 top-up and the limit back at $5.00).
2. **Cosmo header** read "Chat $0.006 · Generations $0.0005" after a conversation that ran a
   FLUX Schnell (Cloud) generation (spend card quoted about $0.0005) and local Krea 2 runs, which
   added nothing. Chat and generations apart, as asked.

Fabio's one change: centre the readout in the header instead of beside Start over. Done in CSS
(absolutely centred on the header); owed: his glance at it.

**Centring confirmed (Fabio, 2026-09-24, screenshot): "That looks good."** The readout sits centred in the header, Start over untouched. Committed in `beacedd8`.

**CI GREEN (2026-09-24):** run 36048835485 on `beacedd8`, unit + desktop 1-4 all success. Closed.
