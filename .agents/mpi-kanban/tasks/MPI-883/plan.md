# MPI-883 - cloud quality tiers render as `undefined`

## Current State

Not started. Diagnosed in full during MPI-852 (2026-09-21); nothing is written.

## The bug

`QUALITY_LABELS` (`js/components/Compounds/MpiOptionSelector/MpiOptionSelector.js:134-143`)
is a hardcoded tier-id -> label map:

    very_low, low, medium, high, very_high, 1k, 2k, 4k

`_buildQualityOptions` (`:176`) renders `QUALITY_LABELS[t]` into BOTH the option label
and its `info` string. A tier id with no entry prints the word `undefined` twice.

The cloud ModelDefs declare ids the map has never seen:

| models.js | tiers |
|---|---|
| `:1971` | `['1.5k', '2k']` |
| `:2134` | `['480p', '720p', '1080p']` |
| `:2176` | `['480p', '720p', '1080p']` |
| `:2201` | `['720p', '1080p']` |

Four missing keys: `1.5k`, `480p`, `720p`, `1080p`.

## Root cause, not the symptom

`qualityTiersFor()` (`js/utils/ratios.js:739`) already resolves tiers generically -
`DECLARED_TIERS_BY_TYPE` is built by walking `MODELS` for `qualityTiers`, so a new
model's tiers reach the radio with no code change. The LABEL map never got the same
treatment, so every new tier id is a silent `undefined` waiting to happen. The comment
on line 140 says so in as many words: it was added for Krea2's `1k` after this exact
failure.

So the fix is two parts, and the second is what stops it recurring:

1. Add the four missing labels.
2. Make a missing key fall back to the raw id rather than `undefined`. A tier reading
   `480P` is at worst ugly; one reading `undefined` is a bug report.

Check `_tierHint` (`MpiOptionSelector.js:147`) in the same pass - it is per-model and
keyed the same way, so it may have the same hole.

## Remaining Work

- [ ] Four labels added; decide the exact casing with the rest of the map
      (`1K`/`2K`/`4K` are uppercase, so `480P` or `480p` is a real choice - look at
      what the tile sheet and the picker already print for these models)
- [ ] Missing-key fallback to the raw id, so the next new tier cannot print `undefined`
- [ ] `_tierHint` checked for the same hole
- [ ] A test that walks every `ModelDef.qualityTiers` id in `MODELS` and asserts each
      one resolves to a non-empty label that is not the string `undefined` - that is
      the assertion that would have caught this when MPI-850 landed, and it needs no
      maintenance as models are added
- [ ] Proved RED before the fix

## Verification

**Verify mode:** `auto`.

- `npm test` green, with the new test proved red on pre-fix code
- `npm run lint:components` green
- The radio read in the app on one cloud video model and one cloud image model
  (Fabio's look is welcome but not the gate - the test is)

## Ownership

`js/components/Compounds/MpiOptionSelector/MpiOptionSelector.js` and its test. Do NOT
edit `js/data/modelConstants/models.js` - the tier ids there are correct and are the
provider's own vocabulary; the label map is what is wrong.
