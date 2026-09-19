# Comfy Developer Platform + Comfy Router (added 2026-09-19)

Addendum to [01-aggregators.md](01-aggregators.md). Comfy was absent from the original
2026-09-11 sweep: at that point it was our *engine*, not a candidate *provider*. It is now
both, and it lands directly on this research's biggest open question.

Source: ComfyUI livestream "Developer Platform 101", 2026-09-18 (video `69slO15ovL8`), plus
`comfy.org/platform`, `comfy.org/pricing` and `docs.comfy.org/tutorials/partner-nodes/pricing`,
all read 2026-09-19. Product background: [[reference-comfy-developer-platform]].

---

## Status, read 2026-09-19 — not vapourware

| Piece | State |
|---|---|
| **Comfy Router** (thousands of models, one API) | **Live.** Python + TypeScript SDKs on PyPI/npm, plus curl. Key from `platform.comfy.org` |
| **Builds** (custom nodes, LoRAs, deps → reproducible image) | **Live** |
| **Comfy API** (workflow → production endpoint) | **BETA.** No GA date published |
| Multi-provider fallback + "transparent" pricing | **Not live.** Promised "the next week or two" from 2026-09-18. Partners unnamed |
| Intent-based routing ("remove background" picks the model) | No date. "At some point" |
| In-app agent / knowledge base into MCP | No date. "Eventually" |
| Local-ComfyUI MCP | Roadmap only, no date. **This is the one aimed at our connector** |

---

## Why this matters more than another aggregator row

Finding #6 of this research said **one vendor could serve both proprietary models and our own
ComfyUI graphs: fal.ai** — and that the single fact deciding one-vendor vs two-vendor was
whether fal accepts *arbitrary third-party custom nodes*. That question is still open (next
step #3 in the README).

**Comfy Developer Platform answers it by construction.** It is ComfyUI. Builds exist
specifically to package custom nodes and LoRAs into a reproducible deployment — the same shape
as this repo's own `dev_configs/node_lock.json` pinning. Our MpiNodes pack is not an
integration risk there; it is the native case.

So the one-vendor plan now has **two** candidates, and the newer one does not carry the blocker.

---

## Pricing, converted

Subscription tiers imply a credit rate. $192/yr ÷ 50,400 cr, $336 ÷ 88,800 and $960 ÷ 253,200
all land within a rounding error of each other:

**~$0.0038 per credit** on Standard / Creator / Pro. Team is *worse* at ~$0.0043
($7,560 ÷ 1,772,400).

Partner-model prices are published in credits. At $0.0038/credit:

| Model | Published | USD |
|---|---|---|
| Kling v3-omni 720p, no audio | 17.72 cr/sec | **$0.337 / 5s** |
| Kling v3-omni 720p, audio | 23.63 cr/sec | $0.449 / 5s |
| Kling v3-omni 1080p, audio | 29.54 cr/sec | $0.561 / 5s |
| Kling v2v 1080p | 35.45 cr/sec | $0.674 / 5s |
| MiniMax H3 768p | 27.16 cr/sec | **$0.516 / 5s** |
| MiniMax H3 2K | 39.22 cr/sec | $0.745 / 5s |
| Hailuo 02 768p | 59.08 cr / 6s run | $0.225 / run |
| Hailuo 02 1080p | 103.39 cr / 6s run | $0.393 / run |
| Veo 3.1, 4K with audio | 126.6 cr/sec | **$2.405 / 5s** |
| Nano Banana (gemini-3-pro-image), image out | 30.38 cr / 1K tok | $0.115 / 1K tok |
| GPT-Image 2, image out | 7600 cr / 1M tok | $28.88 / 1M tok |

**Comfy Router is NOT a wholesale discount.** Against this research's own band — Higgsfield
selling Kling 5s at $0.23 on a $0.28–$0.42 wholesale — Comfy's $0.337 sits mid-band. fal was
measured 10–33% *under* Kling direct; Comfy is not. **The Router buys one integration, not
cheaper models.** Treat it as a convenience play, never a margin play.

Developer-platform GPU time is separate and pay-as-you-go, billed by the GPU second:
**$3.49/hr (RTX PRO 6000) → $8.64/hr (B200)**. Compare against RunPod in
[04-architecture-and-billing.md](04-architecture-and-billing.md) before assuming it is dear.

### Two numbers that do not reconcile — do not average them

`comfy.org/pricing` says a 5-second video is "approximately 11 credits" (~$0.042). The partner
table puts H3 at 5s = 135.8 credits (~$0.516). Twelve times apart. The 11-credit figure is
almost certainly an OSS model on their own GPUs, not a partner call. **Confirm which before
either number enters a financial model.**

---

## Credit mechanics — the tenth data point for finding #7

File 05 found that breakage is a large part of real market margin, and that every platform
except Kie.ai expires subscription credits monthly. **Comfy does the same:** plan credits
"reset at the end of each billing cycle and don't roll over"; *top-up* credits persist for one
year. Two-speed expiry, same as the rest of the field.

Their two-layer split is also the cleanest statement of the thing Vision will have to say the
day a cloud tier sits beside local-GPU:

- Discovery / search tools: **free**
- Generation: spends **metered compute credits**
- A partner/API model: the partner's per-run price **on top of** compute
- OSS weights on their cloud **still spend compute credits** — free of charge *"only when the
  user runs it locally on their own install"*

They also instruct their own agent never to auto-route to the paid path when an OSS route
exists: name both, ask the user. Good default if we ever route.

---

## Resale terms — read 2026-09-19. The paper says no.

This was the top open question. It is now answered, and it goes against the convenient reading.

**The stream said yes.** A chat question asked whether a deployed Comfy workflow could be
exposed as a private API for a commercial or client-facing product. The answer on air
(09:48–10:51 of `69slO15ovL8`) was yes — *"you can deploy those and they can become endpoints
that you can then hit internally, externally, provide access, don't provide access"*, and
*"you could start a business off of that if you want."*

**The written terms say otherwise** ([Terms of Service](https://www.comfy.org/terms-of-service)):

- The grant is *"non-exclusive, non-sublicensable, non-transferable … for your **internal
  business purposes**"*
- *"you will not, directly or indirectly: (i) sublicense the Comfy Products for use by a third
  party"*
- *"use the Comfy Products to create a product or service **competitive with Comfy's products
  or services**"*

That third clause deserves attention: Cubric Studio is a ComfyUI-based generation product;
Comfy Cloud is a ComfyUI-based generation service. We are plausibly inside it.

**Enterprise does not carve it out.** [Enterprise MSA](https://comfy.org/enterprise-msa)
carries the *same* two prohibitions with no exception. Any resale right would have to come
from a negotiated Order Form via sales, not from a document we can read.

**Critical distinction the stream blurred** — two different things, only one of which was
actually answered:

| | Shape | Reading |
|---|---|---|
| **(a)** Our OWN workflow on their GPUs, sold as our product | Renting compute, like RunPod | What the stream said yes to. Plausibly fine |
| **(b)** THEIR partner models (Kling, Veo, Nano Banana) resold through our app | Sublicensing | What a credit system needs. The terms forbid it |

**And the one upstream licence Comfy does resell excludes our shape explicitly.** Comfy is
*"the only official reseller of MiniMax commercial-use licenses, for running MiniMax models
locally on your own hardware"* ([MiniMax licence](https://comfy.org/minimax/license/)) — but
that licence does **not** cover *"reselling or sublicensing the model, and running a model
marketplace, API aggregator, inference-as-a-service, or model-routing platform."*

So routing through Comfy does not absorb the upstream licensing burden. It adds a second layer
of terms on top of the model licence that still applies underneath. **Finding #5 of this
research holds: no aggregator's permission overrides the upstream model licence.**

## No wholesale tier exists

The intuition that an app developer buying in bulk gets better-than-retail pricing is not
supported by anything published. The credit rate runs the **wrong way**: ~$0.0038 on Standard,
Creator and Pro, but ~$0.0043 on **Team** — the larger customer pays *more* per credit. Partner
prices are published flat in credits with no developer or volume tier. Developer-platform GPU
time is pay-as-you-go per GPU-second and is separate from partner-model credits.

A negotiated Order Form could change this. Nothing readable does.

## H3 — corroboration, plus one genuinely new route

Comfy's MiniMax page independently confirms the territory bar this repo already handles: a
commercial licence is explicitly required to use MiniMax H3 in the **US, EU, UK and South
Korea**. That matches [docs/models/h3/README.md](../models/h3/README.md) § Licence, our
authorization granted 2026-08-05, and the `MpiLicenceGate` built in MPI-451. **Nothing here is
a gap in what we ship.**

What *is* new: there is now a purchasable commercial-licence route for end users running H3
locally on their own hardware, at `platform.minimax.io/h3-license`, resold by Comfy. Before
this there was no route. Worth a legal read on whether our flow-down already covers a user's
commercial output use in those four territories, or whether pointing them at that route is the
cleaner answer. Related: [[project_v150_ships_klein9b_ungated]] (MPI-357, weights with no
receipt).

## Open questions this adds

1. **Is the stream's "start a business off that" obtainable in writing?** Product intent and
   legal boilerplate clearly disagree, which is common and sometimes resolvable. It would take
   a negotiated Order Form via sales, and it is the only thing that unlocks shape (b).
2. **Does the "competitive product" clause name us?** Worth a solicitor's eye before we depend
   on Comfy for anything load-bearing, not only for resale.
3. **Does multi-provider fallback actually land, and at what prices?** Only dated item on the
   board: ~2026-10-02. It is the one change that could move Comfy from mid-band to competitive.
4. **Beta risk on Comfy API.** Workflow-to-endpoint is the piece we would depend on and it is
   the piece still in beta, with no GA date.

## Verdict for this file

Convenient, yes — one integration instead of N, and Builds removes the custom-node blocker that
stalled the fal decision. But it does **not** solve licensing (it adds a layer on top of the
model licence that still applies underneath), and it does **not** get us cheaper models
(mid-band, no wholesale tier). Keep it on the list as the low-effort option; do not plan a
credit system around it without a negotiated agreement.
