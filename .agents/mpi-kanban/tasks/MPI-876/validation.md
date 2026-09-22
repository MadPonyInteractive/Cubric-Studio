# MPI-876 Validation

**Verify mode:** `user-ux` — it is a dialogue about the user's money. Both MPI-876 and the
absorbed MPI-854 said so independently. The offline half is below and it is green; the half
that needs a real key, a real app and a fraction of a cent is Fabio's, and is listed last.

## What ran here, 2026-09-22

```
node --test tests/agent-loop.test.cjs             ->  97 pass, 0 fail, 1 skipped (live, no key)
node --test tests/agent-generation-relay.test.cjs ->  19 pass, 0 fail
node --test tests/agent-ui-surfaces.test.cjs      ->  14 pass, 0 fail
node --test tests/agent-no-delete.test.cjs        ->   4 pass, 0 fail
npm test                                          -> 1783 pass, 0 fail, 1 skipped, 1 todo
npx eslint <the two components touched>           -> clean
```

The one `todo` is `agent-video-attachment.test.cjs:123`, MPI-867's known failure — the panel
composer takes images only since MPI-797 Phase 3. It is red on HEAD and nothing here touches it.

## Proof the gate bites

Six mutations, each applied ALONE and reverted, baseline back to 0 fails between every one:

| Mutation | Result |
|---|---|
| the single-call gate is skipped (`if (false)`) | **7 fail** |
| the fan-out gate is skipped (`const spend = null`) | **3 fail** |
| `_askSpend` accepts any truthy answer (`!!yes`) | **1 fail** |
| `getHistory()` drops `price` from the projection | **1 fail** |
| `confirm()` sends a spend card down the install path | **4 fail** |
| `reset()` resolves a spend card with the install string | **0 fail** |

And three on the card's copy, same method:

| Mutation | Result |
|---|---|
| the price is reformatted (`Number(price).toFixed(2)`) | **2 fail** |
| the null line guesses a cause ("bills by GPU time") | **1 fail** |
| the batch line drops the batch figure | **1 fail** |

**The last gate mutation is green ON PURPOSE and it is worth reading.** Backing `reset()`'s
own branch out changes nothing, because `_askSpend` answers `yes === true` — so the install
path's truthy `'declined'` string, and every other non-`true` value, is already a refusal.
The `reset()` branch is the SECOND defence on that path, not the one that bites. It is kept
because this is the money path and the next kind added beside it may not be so strict, and
the comment at the site now says exactly that instead of claiming to be load-bearing. The
defence that DOES bite is pinned by its own test, which walks
`['declined', 'yes', 1, {}, undefined, null]` through a live card and asserts each spends
nothing.

## What was built, and the one place it departs from the plan

The gate is in `services/agentLoop.mjs`, raised as `agent:confirm` with `kind: 'spend'`, and
the card is the existing `_appendConfirm` in `MpiAgentChat.js` with a third branch. That is
the plan's shape.

**The price is NOT computed in the loop, and the absorbed MPI-854 map assumed it would be.**
The loop holds a ratio LABEL and no pixels; the price is a function of the pixels actually
sent (`priceImageUnits` scales by area, and `deepinfraSizing` fits a size to the endpoint's
own bounds on the way out). So the quote is taken where the run is resolved — the renderer —
through `estimateRunCost`, the same call MPI-852's live tag makes. One formula, one number,
two surfaces, which is what both cards asked for. That costs one new capability
(`generation.quote`), one new route (`POST /connector/quote`), one `agentTools.mjs` export
and one line in the `agent-no-delete` allowlist, whose own header says a new route belongs
there when it is added on purpose. It is a READ: it resolves and prices and dispatches
nothing.

**A separate route rather than a flag on the submit**, deliberately. `/connector/generate`
builds its renderer input from a whitelist, so no field a caller sends can turn a submit into
a quote, and a mistyped path is a 404 rather than an unasked-for generation. On a money path
the failure has to fall towards spending nothing. Both directions are pinned by a test.

Also fixed in passing, because the projection had to carry `kind` for the branch to work:
`GET /agent/history`'s `pendingConfirm` was already dropping the BATCH card's `count` and
`what`, so a reload mid-batch repainted "Run this over undefined cards?". It now carries every
field any kind paints from.

## Settled here, and worth not re-deriving

- The gate sits immediately **before the fire**, after the ratio snap and after media
  resolution — not at the plan's `:924`. The plan's own reason for the earlier site ("before
  the ratio snap, so the price quoted is the price of what actually gets sent") is backwards:
  the snapped ratio IS what gets sent, so pricing before it quotes the wrong picture. Nothing
  between the two points can spend money. A test pins that the quoted body and the sent body
  carry the same model, op, media and ratio.
- A fan-out asks **once, in `_fanOut`, before any card runs**, and the spend card REPLACES the
  batch card rather than stacking on it. A billed batch below `BATCH_CONFIRM_ABOVE` still
  asks; a free batch above it still gets MPI-870's card, untouched.
- The batch figure is one `estimateCost` call times the count, as a NUMBER, formatted once.
  `display` is never multiplied — below a cent it is one significant figure.
- A quote that cannot be taken at all (the app unreachable) raises **no card and blocks
  nothing**: that call is about to fail in the submit for the same reason, spending nothing.

## Fabio's live run, 2026-09-22 — single run PASSES, batch of two FAILS

- **Single run: pass.** "Use FLUX Schnell" → card read `Run this on FLUX Schnell (Cloud)?` /
  `Runs on your DeepInfra key and costs about $0.0005.` No declined cleanly and the agent
  said so; Yes landed "Pony runs off on the beach", 1344x768. Items 1 below: done.
- **"Can you do a batch of two?" → TWO spend cards, $0.0005 each.** Fabio: a batch of two
  should be ONE card with the price for both, then run both. Likely cause, NOT yet verified
  in code: t2i has no image slot, so `_fanOut` refuses `cards` with BATCH_UNSUPPORTED, and
  `/connector/generate` refuses `batch` ("Agents never batch", Fabio 2026-09-15), so the
  model just called `generate` twice and each call asked. The 2026-09-15 rule was about N
  latents held in VRAM at once, not N queued submits — check that before designing.

## Left for Fabio — the half no test here can reach

1. **One real gated run.** A cloud model, any prompt. The card should read
   `Run this on <model>?` / `Runs on your DeepInfra key and costs about $X.` — and nothing
   should be billed until Yes. `flux-schnell-cloud` at $0.0005 is the model the plan picked
   for exactly this.
2. **The figure against the bill.** The number on the card should match
   `generationSettings.cost.usd` in the landed card's sidecar, on the high side.
3. **The copy is a DRAFT he has not seen.** The sentences are in plan.md's table and are his
   to reword; the code reads them from one place.
4. **One question, not a decision I could make:** should `POST /connector/generate` itself
   refuse an unconsented paid run? The absorbed MPI-854 map asks for it, but the route has no
   consent gate BY DESIGN — a CLI agent's user is its own gate — and the shipped
   `cubric-vision-generate` skill takes that path, so refusing there breaks it. Raised, not
   decided, and nothing here changes that route's behaviour.
