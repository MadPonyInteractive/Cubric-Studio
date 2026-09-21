# MPI-869 — Prove the out-of-credits path a user actually sees

**Related to the MPI-849 umbrella** (paid cloud models on the user's own DeepInfra key), but
not a member: this verifies what MPI-851 already built rather than building anything new.

Fabio, 2026-09-21, with his own balance at **$2.26 prepaid** and **$2.20 of a $5.00 monthly
limit** used: *"we need to give the user some information that his credits have run out, like
a toast."*

## The good news: it is already built

- `routes/deepinfra.js:80` — `_codeForStatus` maps HTTP **402 → `NO_CREDIT`**.
- `js/services/cloudExecutor.js:50` — `ERROR_COPY.NO_CREDIT` reads *"DeepInfra rejected the
  charge. Top up your balance at deepinfra.com and try again — nothing was generated and
  nothing was billed."*
- `_settleError` emits `ui:error`, which is the toast.

So this card is **not "add a toast"**. It is: prove the toast is the one that actually fires,
because nothing has ever exercised it against the real provider.

## The two things that are assumed, not known

**1. Does an empty balance really answer 402?** If DeepInfra returns 400 or 500 instead,
`_codeForStatus` maps it to `CONTENT_FILTERED`, and the user is told *"The model refused this
prompt or image… try another model or reword the prompt."* That sends someone with an empty
wallet off rewording prompts forever. **This is the failure worth catching** — a wrong-but-
confident message is worse than a generic one.

**2. The monthly cap is a different stop from prepaid exhaustion.** Hitting the `$5.00` limit
is not the same event as the balance reaching zero, and nothing in `_codeForStatus` has a case
for it. If it answers **429**, it falls through to `PROVIDER_ERROR` — *"The provider could not
complete this generation."* — which never tells the user to raise their limit, the one thing
that would fix it. Needs its own code and copy if so.

## How to test, cheaply

**The monthly cap is testable for free, today.** Lower the limit in the DeepInfra dashboard to
just above current usage (Billing → Monthly Usage → Set Limit), then run one FLUX Schnell
(Cloud) dispatch at about **$0.0005**. Whatever status comes back is the answer to (2).
**Fabio must make the dashboard change himself** — it is an account setting, not something an
agent may touch.

**Prepaid exhaustion has to wait for the balance to genuinely reach zero.** Do NOT spend
$2.26 down to test it; it will get there on its own.

Capture, for each: the upstream HTTP status, the code the route returned, and the toast copy
the user saw. Then fix the mapping and the copy to match reality.

## Watch out

`routes/deepinfra.js` must **never log or return the upstream body** — DeepInfra's account
responses carry a billing address and card last4, and `secretRedaction.js` cannot scrub those.
Record the STATUS and the derived code, never the body. That constraint is why this card reads
the status rather than parsing an error message for the word "credit".
