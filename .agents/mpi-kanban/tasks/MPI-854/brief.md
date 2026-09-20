# MPI-854 — the agent states a price, and the gate it cannot talk around

**Umbrella:** MPI-849 phase 2. Needs MPI-850 (the estimate) and MPI-851 (the `provider` field).

**Verify mode:** `user-ux`.

## What Fabio asked for

The agent says what it will cost and dispatches **only** after the user presses OK.
**Settled 2026-09-20:** a batch raises **ONE** card carrying the batch total and the count, not
one card per generation. **Batch size 4**, the SDXL shape. Capacity is not a constraint —
DeepInfra allows **200 concurrent requests per model**, verified on the account.

## The mechanism already ships

`agent:confirm` → `POST /agent/confirm`, today `kind: 'install'` showing a download size. The
route validates only `confirmId` and `yes` and is entirely **kind-blind**.

**`kind` is not an enum anywhere — it is written once and read nowhere.** So a new value is
not rejected; it is *ignored*, and the card repaints as "Install undefined?". The failure mode
is a **wrong card, not an error**.

Six edits, no new route, no new event, nothing in `agentTools.mjs`:

1. Emit the new kind with the estimate, and put the whole pending call on `_pendingConfirm` —
   it carries only install fields today.
2. Add the new fields to the `pendingConfirm` projection in `GET /agent/history`, **or a
   reload loses the price and the Yes button still spends.**
3. Branch `confirm()` on `pc.kind`, defaulting to `'install'` for a card pending across the
   upgrade; the decline text hardcodes "the installation".
4. Branch the card in `MpiAgentChat` and actually pass `kind` through, in both the SSE path
   and the history-replay path.
5. Update the four places that describe the card as install-only.
6. Nothing in `services/agentTools.mjs` — see the test trap below.

## Where the gate goes

**`services/agentLoop.mjs:924`** — after the existing gates, before the body build, and well
before the fire at `:1004`. `generate()` is fire-and-almost-forget and the 2-second race that
follows only learns whether it was *refused*, so anything after `:1004` has already spent the
money. It is also before the ratio snap, so the price quoted matches what is sent.

## Four paths bypass an agentLoop-only gate

- **`POST /connector/generate`** has **no consent gate at all**, by design — the sibling
  install route says so in as many words, *"a CLI agent's user is its own gate"* — and it is
  the path the shipped `cubric-vision-generate` skill takes. If the requirement is "no paid
  generation ever runs without consent", the enforcing check belongs here, server-side, with
  the *card* raised by `agentLoop`.
- **The user's own Cue press** through `enqueueGeneration` — not covered; that is MPI-852's
  price tag plus MPI-851's gate.
- **The Flow branch**, where `model.id` is null, so a model-keyed predicate never fires.
- **Crash-requeue.** `unfinished-generations.md` is written at submit precisely so a closed
  app can re-fire the exact call — a paid requeue would **re-spend silently** and must raise a
  fresh confirm.

## Test trap

`tests/agent-no-delete.test.cjs` drives every `agentTools.mjs` export against a real
throwaway server and asserts each observed `METHOD /path` is allowlisted; it also pins the
tool-name list and rejects any name matching `/delete|remove|…|purge/`.

## Verify

The agent asking for a paid generation raises a card showing the estimate and spends nothing
until Yes; a batch raises one card with the batch total and the count; No records a decline
that does not say "installation"; a reload mid-confirm repaints the card **with** its price; a
direct `POST /connector/generate` for a paid model without consent is refused with a coded
error an agent can read; `npm test` green.
