# MPI-876 — The agent asks before it spends, and says roughly how much

*Fabio, 2026-09-21, after watching the in-app agent run a billed cloud model unprompted:
"The agent can't run it without first giving the user a little yes/no box... part of it is that
the agent has to tell the user how much the user is going to spend, approximately, in a short
sentence." Under the MPI-817 agent-reliability umbrella. NOT STARTED — planned only.*

## Why this is a separate card from MPI-875

MPI-875 (the MPI-849 cloud umbrella) ships the rank and the **note**, so the agent does not
reach for a paid model first and *has the words* for what a run costs. That is not a control:
a note the model may or may not act on still leaves the user's money to the model's judgement.
Fabio asked for the **gate**.

> Their note makes the agent able to SAY it; this card makes it ASK.

Split agreed with that session 2026-09-21. This card claims nothing of theirs.

## The seam already exists — this is its third instance

`agent:confirm` is a general yes/no card, not an install-specific one:

| kind | says | shipped |
|---|---|---|
| `install` | "Install X? Download: 6.0 GB" | MPI-774 |
| `batch` | "Run this over 6 cards?" | MPI-870, 2026-09-21 |
| **`spend`** | **"…about $0.40"** | this card |

Server: `_emit('agent:confirm', …)` + `this._pendingConfirm` + `confirm(confirmId, yes)` in
`services/agentLoop.mjs`. Renderer: `_appendConfirm(data)` in `MpiAgentChat.js`, which already
branches on `kind` and already has a subtitle slot carrying "the cost being agreed to" (GB for
an install, generation count for a batch). A price is the same slot.

**Trap MPI-870 already paid for:** each kind resolves in its OWN vocabulary. `reset()` resolves
a pending confirm with the string `'declined'`, which is truthy — a boolean-waiting kind reads
that as YES. Whatever `spend` waits on, `reset()` must resolve it to a refusal. There is a test
for this shape (`tests/agent-loop.test.cjs` → "a reset while the card is up is a NO, not a yes").

## The price: call `estimateCost`, never a number of our own

`js/data/modelConstants/deepinfraPricing.js` (MPI-850/MPI-853). Verified reachable from CJS by
`require()` on this Node and exercised on 2026-09-21:

```
estimateCost(endpointId, { width, height, steps, references, batch, resolution, duration })
  -> { usd, unit, batch, display, checkedOn } | null
```

```
estimateCost('google/nano-banana-2', { width: 1376, height: 768 })
  -> { usd: 0.067296, unit: 0.067296, batch: 1, display: 'about $0.07', checkedOn: '2026-09-20' }
estimateCost('google/nano-banana-2', { width: 1376, height: 768, batch: 6 })
  -> { usd: 0.403776, display: 'about $0.40' }
estimateCost('nope/nope', {}) -> null
```

**It is accurate against reality.** Fabio's own billed run on 2026-09-21 cost `usd 0.067257`
(from the card sidecar's `generationSettings.cost`); the estimator says `0.067296` for the same
model at the same size. Within $0.00004, and on the HIGH side, which is the direction he asked
for. Independently checked here, not taken from the report.

Rules, from the owning session and confirmed by the run above:

- `endpointId` is `model.cloud.endpointId`, **not** our model id.
- `display` is sentence-ready. Use it; do not format a number ourselves.
- **Pass `{ batch: N }` and use the returned `display`. NEVER multiply `display`.** Sub-cent
  prices render at one significant figure, so six lots of "about $0.0005" cannot be multiplied
  back out of the string.
- **Pass the REAL width/height off the injection params.** `priceImageUnits` scales by
  `(w × h) / 1MP` against the model's `default_width`, and by `steps / default_iterations`
  where the model carries a step term. Omit them and it quotes the model's default size — the
  wrong number for a 4:5 tile or a 16:9 render. `default_width: 0` = flat per image, resolution
  genuinely irrelevant.
- Video: takes `resolution` + `duration`. Veo publishes no duration field and prices its own
  fixed clip length regardless of what is asked.
- `PRICES_CHECKED_ON` is exported if the card should date the figure.

**HANDLE `null`.** Returned for a shape that cannot be known before the run
(`pricing.type: 'time'` — GPU-seconds — and `frame_units`). Nothing we ship prices that way
today, so it is a guard, not a common path. A gate that renders `undefined` or silently drops
the sentence would be worse than no gate: **say it bills and cannot be quoted, and still ask.**

## It folds INTO the batch card, it does not stack on it

Six cloud cards must be ONE card saying roughly 6 × the per-image price — never six cards, and
never a silent multiply. `_fanOut` already asks once above `BATCH_CONFIRM_ABOVE`; a cloud batch
has to reach that same card carrying `{ batch: N }`, not raise a second one after it. A cloud
batch **below** the five-card threshold still needs the spend card, because the threshold is
about fan-out noise and this is about money.

## Answered by Fabio, 2026-09-21

**ASK EVERY TIME.** No "don't ask again", no per-conversation memory, no per-model exemption.
His words: *"The agent should never do a cloud generation without the user clicking a yes button
or an OK button. We do this in this first version. If users start complaining that it's pissing
them off, then we'll revisit later."* So the tiring-at-$0.07 objection is heard and deliberately
overruled for v1 — do not design a suppression path in, and do not re-raise it without user
complaints to point at.

**Test with `flux-schnell-cloud`** (`black-forest-labs/FLUX-1-schnell`), **$0.0005 an image** —
134x cheaper than the nano-banana-2 run that started all this, so a full gate test costs
fractions of a cent. **Settled by Fabio directly on 2026-09-21**, not inferred: he transcribed
it as "FluxKline" by speech-to-text and confirmed in the next breath that he meant Flux Schnell.

> Recorded because two sessions spent real effort on it: "FluxKline" reads convincingly as
> **FLUX.2 Klein**, since `models.js:1124` is literally `name: 'FLUX.2 Klein 9B'` and that is
> the family he tests with daily. The MPI-849 session raised that, correctly on the evidence
> available, and it was only his own word that settled it. **Do not re-open this from the
> roster** — the name in `models.js` will keep suggesting Klein forever.

It is also the right **sub-cent regression case**: its `display` is `about $0.0005`, the exact
string that cannot be multiplied back out, so it is what proves `{ batch: N }` rather than a
multiply.

Useful thing learned while chasing it, worth keeping: **Klein's cloud twin is not in our
catalogue at all.** DeepInfra hosts `black-forest-labs/FLUX-2-klein-4b` (~$0.014) and
`-klein-9b` (~$0.015), taking `input_image_1..4`, but neither has a ModelDef, neither is in
`dev_configs/deepinfra-prices.json`, and `estimateCost` returns **null** for both — a live
instance of null case 3, found an hour after that case was written down. Not this card's work;
a roster gap for MPI-849 if anyone wants the local/cloud comparison.

## The copy — DRAFT, Fabio's to reword

**MPI-852 SHIPPED FIRST — it is `done/complete` as of 2026-09-21, and this paragraph used to
say it had not started.** It is the live price tag in the prompt box: the same estimator,
quoted to the human. Fabio chose **A1, the estimate inline INSIDE the Cue button**, and what
is on screen right now reads `CUE | ABOUT $0.14`. The figure there is `estimateCost().display`
verbatim, the tag is hidden for every local model, and the two no-price cases collapse back to
a clean `CUE` rather than showing an empty one.

So the drift question is already answered, not still open: the number is the same call and the
same string on both surfaces. **The one place the two surfaces deliberately DIVERGE is `null`.**
MPI-852 shows nothing when it cannot quote; this card must still ASK and say it cannot be
quoted — a price tag may stay silent, a spend gate may not. That is the "different surface,
different answer" case below, and it is not drift.

**Settled, and not to be re-decided by either card:** the NUMBER is `estimateCost().display`
**verbatim**. It carries its own "about", never renders "$0.00", and drops to one significant
figure below a cent on purpose. The sentence wraps it; nothing reformats it.

Proposed, using the existing title/subtitle slots of the confirm card:

| case | title | subtitle |
|---|---|---|
| one cloud run | `Run this on Nano Banana 2?` | `Runs on your DeepInfra key and costs {display}.` |
| a cloud batch | `Run this on Nano Banana 2, over 6 cards?` | `Runs on your DeepInfra key and costs {display} for 6 generations.` |
| `estimateCost` → null | `Run this on <model>?` | `Runs on your DeepInfra key. The cost is not known until it finishes.` |

So a real one reads: **"Runs on your DeepInfra key and costs about $0.07."**

Why this shape:

- **"your DeepInfra key"** says whose money it is. Vision ships BYO-key, not credits, and the
  user paying is the whole reason the gate exists.
- The batch line quotes the **batch** figure, not the per-image one. `{ batch: N }` into one
  `estimateCost` call; see the sub-cent trap above.
- **The batch title keeps the model name.** Six billed runs is the moment to be more specific,
  not less, so the question being answered carries both facts.
- **The null line names NO cause.** `estimateCost` returns null for three different reasons and
  only one is GPU time: `pricing.type: 'time'`, `pricing.type: 'frame_units'`, and — the likely
  one in practice — **the endpoint id is simply not in the price snapshot**, because a model
  reached `models.js` before `sync-deepinfra-prices.mjs` ran, or an upstream id changed. An
  earlier draft said "this model bills by GPU time", which would have told the user a thing
  that is usually false. Say only what is known. (Caught by the MPI-849 session, 2026-09-21.)
- **Keep the em dash** in the batch confirm's existing subtitle. In-app copy here uses em dashes
  freely (25 in component strings, plus the cloud error copy). The no-em-dash rule is about copy
  Fabio signs PUBLICLY, not in-app microcopy — checked rather than assumed.
- **`PRICES_CHECKED_ON` is deliberately NOT shown.** A date is noise inside a yes/no moment.
  A persistent surface like MPI-852's live tag may be exactly where it belongs; different
  surface, different answer, and that is not drift.

This is a draft to be replaced by Fabio's own words if he has them; he has not seen it yet.

## Owed to the MPI-849 session when this ships

When the gate lets the FIRST cloud batch through, send that run's `cost` objects and card names
to whoever holds MPI-855. Its cost table has three shapes and only one of them makes a per-card
sum correct:

| shape | calls | bills | cards | per-card sum |
|---|---|---|---|---|
| native provider batch (`num_images` / `sample_count`, 2 of 16 endpoints) | 1 | 1 | N, each carrying the WHOLE cost | over-counts |
| **agent fan-out (MPI-870)** | N | N | N, each carrying its OWN cost | **correct** |
| duplicate delivery (the MPI-875 bug) | 1 | 1 | 2, both carrying the whole cost | over-counts |

The discriminator is `cost.at`, the reading timestamp: identical across cards from one call,
distinct across a fan-out. Two legs are measured; **the cloud fan-out leg is DERIVED and has
never been observed**, because the only fan-out on disk is local `ill-anime`, which writes no
cost object at all. This card's first cloud batch is what turns it into a measurement.

`batchFieldFor()` in `deepinfraSizing.js` is the authority on whether a model has a native batch
at all. Not needed unless MPI-876 ever quotes one — ask MPI-849 rather than guess.

## Ownership

`services/agentLoop.mjs`, `js/components/Compounds/MpiAgentChat/MpiAgentChat.js`, and their
tests. **Read-only** on `deepinfraPricing.js`, `models.js` and `modelPriority.js` — all MPI-849's.

## Verification

**Verify mode:** user-ux — it is a dialogue about the user's money.

- A billed op does not dispatch until Yes. Prove it RED by backing the gate out.
- The sentence names a figure that matches `estimateCost(...).display` for the size that
  actually ran, not the model default.
- Six cloud cards = ONE card, quoting the batch figure.
- A local model asks nothing at all.
- `estimateCost` returning null still asks, and says it cannot be quoted.
- `reset()` while the card is up is a NO.

---

# ABSORBED: MPI-854, the implementation map

*Folded in 2026-09-22 by `mpi-umbrella`. **MPI-854 and this card were the same job**, written a
day apart by two sessions under two different umbrellas — MPI-854 as MPI-849 phase 2
(2026-09-20), this card under MPI-817 (2026-09-21). Same seam, same two files, so they could
never have run in parallel. MPI-854 is now `done/rejected` as a duplicate and everything it
knew is below; nothing was dropped. **This card is therefore BOTH umbrellas' phase — report it
to MPI-849 as well as MPI-817 when it ships.***

Everything above is the WHAT and the words. This half is the WHERE and the how, and it is the
part that had no home in this card before the merge.

## Dependencies, as MPI-854 stated them

`MPI-850` (the estimate) — **`done/complete`**, this is `deepinfraPricing.js` above.
`MPI-851` (the `provider` field on the ModelDef) — **still `doing/validating`**, on two live
checks only Fabio can do. **That is the real gate on starting this card**, not anything in the
plan: the predicate that decides "is this op billed" reads the field MPI-851 ships.

## Where the gate goes

**`services/agentLoop.mjs:924`** — after the existing gates, before the body build, and well
before the fire at `:1004`. `generate()` is fire-and-almost-forget and the 2-second race that
follows only learns whether it was *refused*, so anything placed after `:1004` has already
spent the money. `:924` is also before the ratio snap, so the price quoted is the price of what
actually gets sent — which is the same reason the copy section insists on passing the REAL
width/height.

> A live peer held `services/agentLoop.mjs` and `tests/agent-loop.test.cjs` at 2026-09-22
> ~09:00Z. Check `state/index.json` before claiming them.

## The mechanism already ships — six edits, no new route, no new event

`agent:confirm` → `POST /agent/confirm`. The route validates only `confirmId` and `yes` and is
entirely **kind-blind**. **`kind` is not an enum anywhere — it is written once and read
nowhere.** A new value is not rejected, it is *ignored*, and the card repaints as
"Install undefined?". So the failure mode here is a **wrong card, not an error** — which is
exactly the MPI-883 shape that just closed, one level up.

1. Emit the new kind with the estimate, and put the whole pending call on `_pendingConfirm` —
   it carries only install fields today.
2. Add the new fields to the `pendingConfirm` projection in `GET /agent/history`, **or a
   reload loses the price and the Yes button still spends.**
3. Branch `confirm()` on `pc.kind`, defaulting to `'install'` for a card left pending across
   the upgrade; the decline text hardcodes "the installation".
4. Branch the card in `MpiAgentChat` and actually pass `kind` through, in **both** the SSE path
   and the history-replay path.
5. Update the four places that describe the card as install-only.
6. Nothing in `services/agentTools.mjs` — see the test trap.

## Four paths bypass an agentLoop-only gate

This is the "gate it cannot talk around" half, and it is the part most likely to be forgotten,
because the card passes its own demo without it.

- **`POST /connector/generate` has no consent gate at all, by design** — the sibling install
  route says so in as many words, *"a CLI agent's user is its own gate"* — and it is the path
  the shipped `cubric-vision-generate` skill takes. If the requirement is "no paid generation
  ever runs without consent", the enforcing check belongs **here, server-side**, with the
  *card* raised by `agentLoop`.
- **The user's own Cue press** through `enqueueGeneration` — not this card. That is MPI-852's
  price tag (shipped) plus MPI-851's gate.
- **The Flow branch**, where `model.id` is null, so a model-keyed predicate never fires.
- **Crash-requeue.** `unfinished-generations.md` is written at submit precisely so a closed app
  can re-fire the exact call — a paid requeue would **re-spend silently** and must raise a
  fresh confirm.

## Test trap

`tests/agent-no-delete.test.cjs` drives every `agentTools.mjs` export against a real throwaway
server and asserts each observed `METHOD /path` is allowlisted; it also pins the tool-name list
and rejects any name matching `/delete|remove|…|purge/`. Touching `agentTools.mjs` is what
trips it — edit 6 says don't.

## Settled by Fabio, 2026-09-20 (MPI-854's own session)

- A batch raises **ONE** card carrying the batch total and the count, never one card per
  generation. Agrees with this card's `{ batch: N }` rule, reached independently.
- **Batch size 4**, the SDXL shape.
- Capacity is not a constraint: **DeepInfra allows 200 concurrent requests per model**,
  verified on the account.

## Verify — MPI-854's list, merged

Everything in **Verification** above, plus:

- A direct `POST /connector/generate` for a paid model without consent is refused with a
  **coded error an agent can read**.
- A reload mid-confirm repaints the card **with** its price.
- `No` records a decline that does not say "installation".
- `npm test` green.

**Verify mode:** `user-ux` — both cards said so independently.
