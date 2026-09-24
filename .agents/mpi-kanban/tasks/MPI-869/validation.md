# MPI-869 Validation

**Verify mode:** `user-ux` — the toast is the deliverable, and Fabio fires it himself.

## 2026-09-24 — what the account API actually says (probed, numbers only)

Fabio pointed at Mpi-Shop-Assistant's `provider-usage.ts`, which reads `/payment/config` and
`/payment/usage`. Probed against the real key, printing key paths and numbers, never strings:

- `/payment/config` carries **only `limit`** (5). No balance field at all, so the
  Shop-Assistant's `balanceUsd` reads null on this account.
- `/payment/checklist` carries the money: `billing_type: "balance"` (prepaid),
  `stripe_balance: -4.44` (Stripe's sign: negative is credit held), `recent: 2.88`
  (this month's usage; `/payment/usage` total_cost 289 cents agrees), `limit: 5`,
  `topup: false`. **The same body carries the billing address and card last4**, so only
  those numeric fields may ever be read out of it.
- Derived: spendable = -stripe_balance - recent = **$1.56**; limit room = 5 - 2.88 = **$2.12**.
  The $1.56 is a hypothesis until Fabio reads his dashboard (on 2026-09-21 he reported
  $2.26 prepaid with $2.20 used, which fits the same formula at a credit of $4.46).

## 2026-09-24 — the pre-flight gate, built

`POST /deepinfra/generate` takes the renderer's price-tag figure (`estimateRunCost().usd`,
sent as `estimateUsd`) and, before dispatch, reads `/payment/checklist` through
`_accountRoom` (numbers only). Estimate > spendable balance → `LOW_BALANCE`; estimate >
monthly-limit room → `OVER_LIMIT`; each message names the cost and what is left. The account
read failing lets the run through: the provider's 402 stays the backstop. The renderer shows
both codes as a `ui:warning` toast, not the error dialog.

- `tests/deepinfra-credit-gate.test.cjs` (5 tests, the probed shape): green; **red** (3/2)
  with the formula backed out to ignore `recent`.
- **Live route, real account, inference stubbed (no spend):** `veo-31-cloud` at 3.20 →
  `LOW_BALANCE`, "costs about $3.20 and your balance has $1.56 left", inference never
  reached. `flux-schnell-cloud` at 0.0005 → passes the gate to (stubbed) inference.
- `npm test`: 1851 pass, 0 fail.
- **Outstanding:** Fabio's run in the app (server change: restart needed) and his dashboard
  figure against the derived $1.56. Seedance (≤ $0.84) and Veo Fast ($1.20) FIT the balance
  and would really bill; Veo 3.1 at $3.20 is the one that must toast. (Corrected after
  Fabio's screenshot: the $0.84 was a mis-called estimate here; the app's own price tag reads
  **Seedance 2.0 at 1080p/5 s = about $1.90**, which does NOT fit and must toast.)

## 2026-09-24 — the agent says it instead (Fabio: "the agent could just tell the user")

The agent's failure used to be dropped twice: `generationService` called `onError()` with no
error, and `agentDispatch` answered every failure with generic `RUNTIME_ERROR` / "see the app
log". Now the executor puts `code` + user copy on the Error, `generationService` forwards it,
and both `agentDispatch` onError sites report it — so the agent gets `LOW_BALANCE` with the
figures. `byAgent: true` rides the agent's config through the payload whitelist, and the
executor skips the toast for it.

- `cloud-executor.test.cjs` "a credit refusal toasts a person, stays silent for an agent":
  green; **red** with the `byAgent` guard removed. `npm test` 1852 pass, 0 fail.
- **Outstanding:** both live runs by Fabio — Cue (toast) and the agent (said in chat).

**LIVE PASS, Cue path (Fabio, 2026-09-24 13:31Z):** Seedance 2.0 i2v, 1080p, 5 s, price tag
$1.90. Toast "Heads up — Not enough DeepInfra credit: this costs about $1.90 and your balance
has $1.56 left…" (screenshot). app.log: `seedance-2-cloud refused before dispatch
(LOW_BALANCE)`. Account usage unchanged after (`recent` 2.88), so nothing billed.

**LIVE PASS, agent path (Fabio, 2026-09-24 13:34Z, after a restart): "Success."** Cosmo raised
the spend confirm at about $1.90, Fabio approved, and Cosmo said in chat that the balance is
too low ($1.90 vs $1.56 left, nothing generated or billed) and offered to hold the prompt or
use a cheaper cloud model. No toast (screenshot). app.log 13:34:13 `refused before dispatch
(LOW_BALANCE)`; `recent` still 2.88.

**Dashboard confirms the balance (Fabio's screenshot, 2026-09-24): PREPAID CREDITS $1.56** —
exactly `-stripe_balance - recent`. One $5 top-up, months ago.

**Correction — the monthly-limit stop was briefly removed and is RESTORED.** The "$0.00 /
$5.00" read came off a screenshot taken before the card had loaded. Fabio's full-page
screenshot: PREPAID CREDITS **$1.54**, MONTHLY USAGE **$2.90 / $5.00 LIMIT** (a cap he set
himself, independent of the balance). The API read at the same moment: `stripe_balance`
-4.44, `recent` 2.90, `limit` 5 — both formulas match to the cent. Tests re-pinned to these
figures; the limit test proved red with `recent` dropped from the room (3/2). `npm test` 1852/0.
Fabio: the agent asking first and refusing after is fine — not a gap.

**LIVE PASS, OVER_LIMIT (Fabio, 2026-09-24 14:33Z) 🎉** Fabio set the limit to $3.00 (usage
$2.98, dashboard screenshot). Cue on Nano Banana 2 edit, price tag $0.07 → toast "This would
pass your DeepInfra monthly limit: it costs about $0.07 and $0.02 of the limit is left this
month…". app.log 14:33:33 `nano-banana-2-cloud refused before dispatch (OVER_LIMIT)`. API
after: `limit` 3, `recent` 2.98, `stripe_balance` -4.44. Usage rose $0.08 between 14:00 and
the test; the refused run never reached the provider, and the month's largest line is the
agent's own LLM (DeepSeek-V4-Flash tokens), which Cosmo was using in that window — per-model
monthly rows cannot attribute it more precisely. **Fabio to restore the limit to $5.00.**

## 2026-09-24 — the brief's open question answered: the monthly cap is HTTP 402

Fabio chatted with Cosmo past the $3.00 limit. DeepInfra let usage reach **$3.01** (its
counter lags) and then refused the agent's chat with **402 Payment Required** — the SAME status
as an empty balance, so the status alone cannot tell them apart. Cosmo showed the raw
"DeepInfra chat failed: 402 Payment Required" (screenshot). Cosmo spent about $0.03 over 5-6
questions (Fabio's read).

- `services/llmEngines.mjs` builds the chat error: a 402 now reads "…refused the request:
  payment required. Either your balance is empty or you have reached the monthly spending
  limit you set. Nothing more was spent. Top up or raise the limit…". Fixed at the source
  because `agentLoop.mjs` (which only relays `err.message`) is claimed by the live MPI-903
  session; the enhancer on the same key gets it too.
- `cloudExecutor` `NO_CREDIT` copy (the generation-side 402 backstop) names both causes too.
- `tests/llm-payment-required.test.cjs`: green; red with the 402 branch disabled. `npm test`
  1857 pass, 0 fail.
- **Not live-checked yet:** Cosmo's new 402 wording (needs a full restart; the limit is still
  $3.00, so one message shows it).


**CI GREEN (2026-09-24):** run 36020583772 on `8d229ed5` (descendant of `74d964a3`), unit + desktop 1-4 all success. Closed.
