# MPI-850 — the price module

**Umbrella:** MPI-849 phase 1. Runs in parallel with MPI-851; they share no file.

**Verify mode:** `auto`. This member needs no app, no key and no GPU.

## Why it exists

Three surfaces need the same number: the prompt box (MPI-852), the agent's confirm card
(MPI-854) and the library tile (MPI-853). Three copies of a pricing formula is three places to
drift. This is one module, with the arithmetic pinned by tests against real billing.

## What is already measured

All of it is in `docs/proprietary-models-research/01d-deepinfra-image-video.md`. Do not
re-derive and do not re-spend — it cost $0.68 to establish.

- **Open image models:** `cost = (cents_per_image_unit/100) x (w*h)/1048576 x (steps/default_iterations)`.
  Four FLUX-1-schnell probes give **$0.0005 per megapixel per step, flat at every size** —
  linear in area, linear in steps, no tiering. It reproduces every published headline.
- **Closed image models** (`default_width: 0`): flat per image, resolution irrelevant.
- **Video:** `tokens = floor(w x h x frames / 1024)`, `frames = 24 x duration + 1`. Exact
  against a measured clip: 864x496 x 97 frames / 1024 = 40,594.5 → 40,594 billed.
- **It is frames, not seconds** — `fps x duration` misses by 1 %.
- **480p 16:9 is really 864x496.** Price from true pixel dimensions, never the label.

## The split that makes this cheap

Of the fifteen agreed models, **nine price themselves** from structured fields on the keyless
`https://api.deepinfra.com/models/list`. Only six need hand-held constants: the four
Gemini-family ids and both Seedance models, whose per-resolution token counts live in prose or
nowhere. **Veo needs a duration constant too** — it has no `duration` field at all, so its
structured per-second rate has nothing to multiply.

So: a build-time script regenerates a committed snapshot, the app prices offline, and a price
change arrives as a reviewable diff. Carry a `checkedOn` date in the snapshot; a stale price
quoted at a user is worse than no price.

## Verify

`node --test "tests/deepinfra-pricing.test.cjs"` green, asserting to the cent:

| Case | Expected |
|---|---|
| FLUX-1-schnell 1024x1024, 1 step | $0.0005 |
| FLUX-1-schnell 1024x512 / 1920x1920 / 4 steps | $0.00025 / $0.0017575 / $0.002 |
| Nano Banana lite / 2 / Pro, 1 K, 1 reference | $0.0339 / $0.0679 / $0.1376 |
| Seedance 1.5 Pro 480p 4 s | 40,594 tokens, $0.0487 |
| Seedance 2.0 480p 4 s (plain call) | $0.3126 |
| Wan 3.0 1080p 5 s | $1.00 |
| Batch of 4, Nano Banana Pro 1 K | about $0.54 |

**Negative controls, and they matter more than the positives:** an unknown model id, and a
`time`-priced model, must both **refuse** rather than return a number. A confidently wrong
price is the failure mode that costs a user money.
