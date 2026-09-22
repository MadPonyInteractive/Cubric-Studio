# MPI-883 - validation

**Verify mode:** `auto`. Done 2026-09-22.

## What shipped

Two edits in `js/components/Compounds/MpiOptionSelector/MpiOptionSelector.js`, plus a
new `tests/quality-tier-labels.test.cjs`.

1. **The resolver, which is the part that stops this recurring.**
   `const _qualityLabel = t => QUALITY_LABELS[t] ?? t;` and the three reads in
   `_buildQualityOptions` routed through it. `qualityTiersFor()` already resolves a new
   ModelDef's tiers with no code change, so the hardcoded label map is structurally
   always one model behind. A missing key now prints the raw id.
2. **One label added**, `'1.5k': '1.5K'` (Seedream 4.5), because `1.5k` is the one new
   id whose correct label differs from itself — the map's other entries are uppercase
   `1K`/`2K`/`4K`.

`480p`, `720p` and `1080p` were deliberately NOT given map entries. The fallback prints
them exactly as the rest of the app already spells them (`deepinfraPricing.js:54-55`,
`MpiModelManager.js:723`, every cloud model's own `description`), so three identity
entries would be duplication that the next tier id still would not cover.

`_tierHint` was checked for the same hole and does not have it: its result is guarded by
`const hint = h ? ...`, so a missing key contributes an empty string, not `undefined`.

## Proved RED before the fix

`node --test tests/quality-tier-labels.test.cjs` on pre-fix code: **3 of 3 red.**

Then, with the resolver in place but its `?? t` fallback stripped, claim 1 reproduced
the reported bug exactly and nothing else:

    seedance → 480p → undefined       wan3 → 480p → undefined
    seedance → 720p → undefined       wan3 → 720p → undefined
    seedance → 1080p → undefined      wan3 → 1080p → undefined
    veo → 720p → undefined            veo → 1080p → undefined

That second run is what proves the test catches the bug rather than merely catching the
absence of the new function.

## Green

- `node --test tests/quality-tier-labels.test.cjs` → **3/3 pass**
- `npm test` → **1762 tests, 1760 pass, 0 fail**, 1 skipped, 1 todo. The one `todo` is
  the pre-existing MPI-867 marker in `agent-video-attachment.test.cjs`, untouched here.
- `npm run lint:components` → clean

## Why the test needs no maintenance

It walks every `type` on every shipped `ModelDef` through the real `qualityTiersFor()`,
and lifts the real `QUALITY_LABELS` and the real `_qualityLabel` out of the component's
source to run them — the component itself cannot be imported from Node (it pulls
`MpiButton` → `icons.js` on a browser-absolute path). Nothing in the test re-implements
the map or the resolver, so a model added tomorrow is covered on the next run. A third
assertion fails if anyone reads `QUALITY_LABELS[...]` directly again, which is the exact
shape of the original bug.

## Ordering slip, recorded

The code edit landed while the card was still in `todo`; it was moved to `doing` with
`files.json` written immediately afterwards, before any board close. Ownership was
claimed in `state/` before the first write, so no peer was at risk.
