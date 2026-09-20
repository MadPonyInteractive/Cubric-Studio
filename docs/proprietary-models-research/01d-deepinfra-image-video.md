# DeepInfra as an image and video provider: measured, 2026-09-20

Added after the original sweep. `01b-more-aggregators.md` rated DeepInfra UNVERIFIED and
described it as LLM-shaped dedicated GPUs. That was incomplete: it also runs a serverless
catalogue of closed and open image and video models, and **Cubric Vision already holds the
user's DeepInfra key** (`routes/llm.js`, the prompt enhancer). For Option A (bring your own
key) that makes it the one provider that needs no new secret, no new settings field and no
new onboarding step.

**Verdict: the strongest Option A candidate found so far, and only Option A.** Charging on
top needs a scoped JWT minted from OUR key (`04-architecture-and-billing.md` § 6.5), which
bills our account and is therefore Option B with every gate Option B carries. Resale terms
for the image catalogue are UNREAD.

Everything below was measured with real calls on 2026-09-20 (total spend $0.34) or read from
the keyless `https://api.deepinfra.com/models/list`. Nothing is from a marketing page.

---

## 1. The catalogue

`GET https://api.deepinfra.com/models/list`, no key: **53 `text-to-image`, 31
`text-to-video`**. Edit and image-to-video models are filed under those same two types, there
is no separate `image-to-image` type.

| Family | Ids seen |
|---|---|
| Google image | `google/nano-banana-2-lite`, `nano-banana-2`, `nano-banana-pro` (= `gemini-3-pro-image`, two ids, one model) |
| Google video | `google/veo-3.0`, `veo-3.0-fast`, `veo-3.1`, `veo-3.1-fast` |
| ByteDance | `Seedream-4`, `Seedream-4.5`, `Seedream-5.0-Pro`, `Seedance-1.5-Pro`, `Seedance-2.0` |
| Black Forest Labs | FLUX 1 dev/schnell/1.1-pro/Kontext-dev/Redux, FLUX 2 dev/pro/max/klein-4b/klein-9b |
| Qwen / Wan | `Qwen-Image-Max`, `Qwen-Image-Edit(-Max)`, `Wan2.6/2.7` T2I, Image-Edit, T2V, I2V, R2V, `Wan3.0-Video` |
| Utility | Bria (erase, expand, gen_fill, remove/replace background, video eraser, video upscale), ClarityAI upscalers, Pixverse, NVIDIA Cosmos3, PrunaAI |

Finding #4 in the README still applies: ByteDance's upstream terms are the worst in the
research, and an aggregator's permission does not override them. Under Option A the user
holds that contract, not us.

## 2. Pricing is FIVE different shapes

`pricing.type` in the models JSON takes five values across these two categories. A price
readout in the prompt box is therefore a small adapter per type, not one formula:

| `pricing.type` | Meaning | Examples |
|---|---|---|
| `image_units` | flat per image (`cents_per_image_unit`) | FLUX, Seedream, Qwen, Bria. Seedream 5 Pro adds tiers: $0.0495 up to 1.5K, $0.099 above, plus $0.0033 per input image after the first |
| `input_tokens` | per-token, output image = a fixed token count | the whole Nano Banana family, Seedance |
| `output_length` | per second of video, tiered by resolution | Wan, Veo, Pixverse 6, PrunaAI |
| `frame_units` | per frame / per clip | Cosmos3, FastWan |
| `time` | per second of GPU time, not knowable before the run | **dead branch** - only SD v1-4, v1-5, 2-1 and Deliberate, all four deprecated 2024-09-27 in favour of `sdxl-turbo`. Every shippable image and video model is priced before dispatch |

**The dashboard hides the per-image price behind a `*`.** The real text is in
`pricing.full` on `https://api.deepinfra.com/models/<owner>/<model>`, prose not structure,
so it cannot be parsed reliably. A shipped price table would be hand-maintained per model.

## 2b. The two formulas that actually price the prompt box

Measured 2026-09-20 against `inference_status.cost`. Between them these cover every model in
section 1 worth shipping.

**Open image models (`image_units` with a non-zero `default_width`) — MEASURED EXACT:**

```
cost = (cents_per_image_unit / 100) x (width x height) / 1048576 x (steps / default_iterations)
```

Four FLUX-1-schnell probes: 1024x1024 1 step $0.0005; 1024x512 $0.00025; 1920x1920 $0.0017575;
1024x1024 4 steps $0.002. That is **$0.0005 per megapixel per step, flat at every size**, so
the formula is linear in area and linear in steps with no rounding or tiering. It reproduces
every published headline: FLUX-1-dev 0.9c x 1MP x 25/25 = $0.009, FLUX-2-dev = $0.01.
`default_iterations: 0` (both kleins) means no step term, just per megapixel.

**Closed image models (`default_width: 0`) — flat per image, resolution irrelevant:**
FLUX-2-pro $0.015, FLUX-1.1-pro $0.04, FLUX-2-max $0.10, Seedream-4/4.5 $0.04,
Seedream-5.0-Pro $0.099, Qwen-Image-Max $0.075.

**Video.** Wan and Veo state a price per second outright. Seedance is per token and states no
token formula anywhere; one measured call (below) gives the constant.

## 2c. Seedance and Wan 3.0, the models actually wanted

**Seedance 1.5 Pro, one real call** (480p, 16:9, 4 s, `generate_audio: false`): **40,594
`out_tokens`, cost $0.0487128, 32 s wall**. That divides to exactly **$1.20 per 1M tokens**,
confirming `cents_per_input_token: 0.00012`. Working constant: **10,148 tokens per second of
480p video**, and tokens scale with pixel area.

| Model | 480p | 720p | 1080p |
|---|---|---|---|
| **Seedance 1.5 Pro** | **$0.0122/s** (measured) | $0.027/s | $0.061/s |
| a 5 s clip | $0.061 | $0.135 | **$0.30** |
| **Seedance 2.0** at $4.7/$5.1 per M | $0.048/s | $0.106/s | $0.259/s |
| a 5 s clip | $0.24 | $0.53 | **$1.29** |
| Seedance 2.0, dearer mode ($7.7/$8.4 per M) 5 s | $0.39 | $0.87 | **$2.13** |
| **Wan 3.0** (stated, not measured) | $0.05/s | $0.10/s | $0.20/s |
| a 5 s clip | $0.25 | $0.50 | **$1.00** |

- Only the 480p Seedance 1.5 row is measured. Everything else scales it by pixel area
  (720p = 2.22x, 1080p = 5.0x) or applies Seedance 2.0's published per-token rates to the same
  token count. **Audio was off**; its surcharge is unmeasured.
- **Seedance 1.5 Pro is roughly 3x cheaper than Wan 3.0 and 4x cheaper than Seedance 2.0** at
  1080p. At $0.30 for a 5 s 1080p clip it is the cheapest credible video model in the
  catalogue.
- **Seedance 2.0's two price bands are unexplained.** `pricing.full` reads "$4.7/M with video,
  $7.7/M without for 480p and 780p; $5.1/M with video, $8.4/M without for 1080p" ("780p" is
  presumably a typo for 720p). Which mode a plain text-to-video call falls into is UNKNOWN,
  and it is a 1.6x swing. Measure before quoting a price to a user.
- Seedance 1.5 takes 4-12 s, Seedance 2.0 4-15 s, Wan 3.0 2-30 s. Seedance 2.0 also takes up
  to 9 reference images, 3 reference videos and 3 reference audios; Wan 3.0 takes a media
  array. Both are far richer inputs than Nano Banana's single image.
- `out_tokens` is returned at the top level, NOT inside `inference_status`, and the video comes
  back as `video_url`, not base64.

## 3. Nano Banana, to the cent

Each bill below is `inference_status.cost` from the API response, and each decomposes exactly.

| Model | Output image | Text output | Input (image + prompt) | One 1K edit, 1 reference |
|---|---|---|---|---|
| `nano-banana-2-lite` | 1120 tok x $30/M | none seen | $0.25/M | **$0.0339** |
| `nano-banana-2` | 1120 tok x $60/M | $3/M (32 tok) | $0.50/M | **$0.0679** |
| `nano-banana-pro` | 1120 tok x $120/M | $12/M (176 tok) | $2/M | **$0.1376** |

- The headline `$/1M tokens` is the OUTPUT IMAGE rate only. The input rate and the text-output
  rate are published nowhere on DeepInfra; they were inferred from exact decomposition.
- **A reference image costs well under a cent** (1120 input tokens on lite and NB2, 560 on
  Pro), flat, regardless of its size: a 3 MP PNG billed the same 1120. So the readout barely
  moves as the user adds references, but it must still count them.
- The models emit a variable number of TEXT tokens, so a pre-dispatch price is an estimate
  good to about 2 percent, not a quote. Show "about $0.07", never "$0.0679".
- Failed calls (HTTP 500) are not billed. Verified against the account's usage page.

## 4. What you actually get back

| | lite | NB2 | Pro |
|---|---|---|---|
| Output | **JPEG** 768x1365, 112 KB | PNG 896x1195, 1.76 MB | PNG 768x1376, 1.37 MB |
| Wall time | 7 s | 16 s | 23 s |
| Swimwear photo edit | accepted | **HTTP 500, twice** | accepted |

- **Nothing above ~1 MP is reachable.** The native route has no resolution field (only
  `prompt`, `image`, `aspect_ratio`, `seed`), and `size: "1296x2304"` on the OpenAI-compatible
  route was billed as the 1K bucket. The 2K and 4K prices on the card had no knob we could
  find. A 3 MP source comes back at a third of its pixels.
- With a reference and no `aspect_ratio`, the output follows the reference's aspect.
- **NB2 is the strict one.** `gemini-3.1-flash-image returned no image data` on a photo both
  its cheaper and its dearer sibling accepted, on both routes. The same character, clothed,
  went through NB2 first try. This is Google's filter, not DeepInfra: the same model failed
  most calls when driven direct through Gemini. For this product's audience, NB2 is the tier
  to leave out.
- The native route takes ONE `image`. Multi-reference editing, which these models support
  upstream, was not found on DeepInfra's surface. UNVERIFIED beyond the schema.

## 5. Spend readout

- Per call: `inference_status.cost` on the native route. The OpenAI-compatible routes return
  only `created` and `data`, so **dispatch on the native route or lose the cost**.
- Per month, per model: `GET /payment/usage?from=2026.09` (seven characters, DOT separated;
  `rate` is in CENTS). For token-priced image models the row carries a total and no unit
  count, so it cannot itemise. The app must keep its own per-generation cost ledger; the
  sidecar is the natural home.
- Balance and spend limit exist on `GET /payment/checklist`, but that endpoint also returns
  the billing address and card last4. Any balance feature must pick fields server-side and
  never log the body.

## 6. What it would take in the app (Option A only)

Additive to `00-cubric-vision-integration-points.md`, which already costs the cloud executor:

1. **No new key.** Reuse `secrets:get-deepinfra-key-request`.
2. A per-model price function keyed on `pricing.type`, fed by the ModelDef, recomputed as
   references are added. Hand-maintained numbers with a "checked on" date.
3. A confirm step for the in-app agent: it states the estimate, and only the user's OK button
   dispatches. The mechanism is already shipped for installs: `agent:confirm` ->
   `POST /agent/confirm` (`docs/agent-chat.md`), today with `kind: 'install'` and a size
   shown. A paid generation is a second `kind` carrying a price instead of gigabytes.
4. A "Paid models" section at the foot of the model library: price, and that it needs a
   DeepInfra key in the remote settings.
5. The cost written to the sidecar per generation, and a spend readout built from that ledger.

The larger idea this opens: a user with no capable GPU runs generation on DeepInfra and keeps
local ComfyUI only for the light tools. That is a product-shape decision, not an integration
one, and it is not taken here.

## Still unknown

- DeepInfra's resale and end-user terms for the image and video catalogue. Irrelevant to
  Option A, decisive for Option B.
- Whether any `size`, `quality` or undocumented field reaches 2K. Only one string was tried.
- Multi-reference input.
- Seedance and Veo: priced from the list only, never called.
