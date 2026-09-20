# MPI-850 Validation

**Verify mode:** `auto`. No app, no key, no GPU — the whole card is offline arithmetic.

## What ran, 2026-09-20

```
node --test "tests/deepinfra-pricing.test.cjs"   ->  29 pass, 0 fail
npm test                                          ->  1580 pass, 0 fail, 1 skipped (pre-existing)
node scripts/sync-deepinfra-prices.mjs            ->  16 models written, checked 2026-09-20
```

Every positive assertion is a real DeepInfra bill from `01d` § 2b/2c/3, not a model of one:
FLUX-1-schnell at four sizes and step counts ($0.0005 / $0.00025 / $0.0017575 / $0.002), a 1 K
Nano Banana edit with one reference on all three tiers ($0.0339 / $0.0679 / $0.1376), the 480p
Seedance clip at exactly 40,594 tokens ($0.0487 on 1.5 Pro, $0.3126 on 2.0), Wan 3.0 1080p 5 s
at $1.00, and a batch of four Pro images at about $0.54.

## The negative controls, which matter more

An unknown model id, a `time`-priced model, a `frame_units` model, a token-priced image model
with no measured token count, and a per-second video model with no duration all return `null`.
`formatPrice` never renders `$0.00`: sub-cent reads "under $0.01", everything else "about $X.XX".

## Proof the tests bite

Three mutations, each run against the suite and then reverted (the file was diffed back to
byte-identical afterwards):

| Mutation | Result |
|---|---|
| `frames = 24 x duration` (drop the +1, the `fps x duration` trap) | 4 tests fail |
| `default: return 0.01` instead of `return null` in `priceFromEntry` | 2 tests fail |
| `usd = unit` instead of `unit * batch` | 1 test fails |

## Not covered, on purpose

- 720p and 1080p video pixel dimensions are ASSUMED (1280x720, 1920x1088); only 480p's
  864x496 was measured. Confirm from the first real clip at each — MPI-851 will have one.
- The audio surcharge on video is unmeasured; audio was off in every measured call.
- Nano Banana's 2 K and 4 K buckets are priced from DeepInfra's published prose, not from a
  bill: nothing above ~1 MP was reachable through the native route.
