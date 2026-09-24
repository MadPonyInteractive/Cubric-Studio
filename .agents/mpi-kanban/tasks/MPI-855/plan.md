# MPI-855 — spend readout: Remote panel + per-session Cosmo line

**Verify mode:** `user-ux`.

## Plan Drift

- 2026-09-24: **No ledger** (Fabio "go"). `/payment/checklist` gives this month's spend
  (`recent`) and the balance to the cent (MPI-869, measured), and counts chat + enhancer spend a
  local ledger would miss. A ledger returns only if a per-model breakdown is wanted.
- 2026-09-24: scope added — per-session Cosmo readout, chat and generations SEPARATE.

## Phase 1: Remote panel readout

- `GET /deepinfra/account` in `routes/deepinfra.js`: reads `/payment/checklist`, answers
  `{ ok, spentUsd, balanceUsd, limitRoomUsd, limitUsd }` built field by field. Upstream body never
  logged or returned; thrown errors rebuilt.
- `MpiLlmSettings.js`: a form-group after the connection probe, a `_conn()` button + hint,
  hidden unless the profile is `deepinfra`, fires on click only.
- Test: response carries no `line1`, `postal_code`, `last4`, `name`; `logger` never sees them.

## Phase 2: per-session Cosmo readout

- `agentDispatch._reportDone`: `costUsd` from `item.generationSettings.cost.usd`.
- `agentLoop.mjs`: `_spend = { chatUsd, genUsd }`, chat += `usage.estimated_cost` per reply,
  gen += `output.costUsd` per settled generation; reset on `reset()`; in `getHistory()` and on an
  `agent:spend` event.
- `MpiAgentChat.js`: one line in the panel header, hidden while both are zero.

## Verification

`npm test`, `npm run lint:components`; Fabio: the panel figures vs his dashboard, one Cosmo
session with a chat and a cloud generation showing the two apart.

## Current State

**2026-09-24 — both phases built, uncommitted, offline-verified; waiting on Fabio's look.**
Details and red/green proofs in `validation.md`. The DeepInfra account is SUSPENDED (limit
$3.48 reached), so a cloud generation for check 2 needs the limit raised first; Check spend
should still read. Next after his OK: commit by pathspec (files.json lists them), close on CI.
