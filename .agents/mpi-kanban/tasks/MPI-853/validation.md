# MPI-853 Validation

**Verify mode:** `user-ux`. Asked for by Fabio on 2026-09-20, straight after the MPI-851
live check, in his words: put them at the foot of the library the way third-party flows
are, label the section, and stop the drawer offering to uninstall something that was never
downloaded.

## What changed

- **`_paidSection()`** at the foot of the Model Library, after the plugins row — the same
  place and shape the Flow Library gives third-party flows. Header "DeepInfra models", a
  one-line note that says they run on the user's own key and that DeepInfra bills them,
  and a tile sheet. Called from BOTH render paths, including the "nothing matched" branch.
- **Out of every count.** The library head counts local models on both halves, and
  `heroStats` filters `provider` out of its numerator and denominator. Adding a cloud model
  moves neither number.
- **A price where a local model shows its size.** `.mpi-tile__chip--paid`, frost, a cloud
  glyph — deliberately not `--available`, whose `::before` draws a download arrow.
  The tile is built without `_modelState`, whose fallthrough renders an Install chip on a
  model with no dependencies, where the click does nothing at all.
- **The drawer.** No footer action: no Uninstall (Fabio's complaint, and it is the branch
  a saved key would otherwise reach through `anyInstalled`), no Install, no Cancel. The
  VRAM trade table and the Disk row are replaced by Cost and Your key, because "0GB of
  weights · min 8GB VRAM" is nonsense for something that needs no GPU.
- **Price copy sharpened** (`deepinfraPricing.js`, MPI-850's module, first consumer):
  sub-cent now reads "about $0.0005" rather than "under $0.01". A tile has to answer
  whether a batch of four is worth it. The four-decimal ban still holds where it was
  written for — a test asserts every Gemini-family price is dearer than a cent, so the two
  rules can never collide.

## What ran, 2026-09-20

```
node --test tests/paid-models-section.test.cjs   ->  10 pass, 0 fail
node --test tests/deepinfra-pricing.test.cjs     ->  30 pass, 0 fail
npx eslint (the three changed renderer files)    ->  clean
npm test                                          ->  1633 pass, 0 fail, 1 skipped
```

The new guards hold the four places this section disappears silently from: both call sites
(the second is inside the empty-search branch), both counts, the drawer's footer branch
ordering, and the list signature that makes a saved key repaint the note.

## For Fabio to look at

1. The library foot: a **DeepInfra models** section under Plugins, with the note and a
   tile reading **about $0.0005**.
2. The head line and the landing hero count: both should be **unchanged** by it.
3. The drawer: description, Cost, Your key — and **no button**.
4. Search "flux" and then something that matches no local model at all: the section stays.

## The catalogue — 2026-09-21

All fifteen ship. Automated checks, all green:

- `node scripts/sync-deepinfra-prices.mjs --check` — clean; the snapshot gained a `limits`
  block per model (+317 lines) and **no price moved**.
- `node --test tests/deepinfra-catalogue.test.cjs` — 20 tests. The load-bearing one walks
  **76 real ratio rows across 7 models** and asserts each survives its own model's sizing
  contract byte for byte; proven non-vacuous by a negative control (1920x1088 at FLUX 2
  Pro's 1440 ceiling is caught and rescaled).
- `npm test` — **1660 pass, 1 fail**, and the one failure is a live peer's uncommitted
  `storedLook` call in `services/agentLoop.mjs` whose test double is not updated yet. The
  symbol does not exist in HEAD and this card touches no agent file.

What the shape turned out to be, because it was not what the brief assumed: DeepInfra takes
**four** different sizing shapes and `in_fields` is not on `/models/list` at all. Both are
written up under `## Plan Drift` in the MPI-849 plan. Nothing about sizing is hand-written:
the fifteen ratio tables are generated from the bounds each model publishes.

## For Fabio to look at, second pass

1. The **DeepInfra models** section now lists **sixteen** tiles. Every one shows a price,
   and none says "price unknown" — the video tiles read *per 5s at 1080p* or *per clip*
   rather than *per image*.
2. **All fifteen render a placeholder thumbnail.** There is no preview art yet; that is a
   graphics pass, not this card.
3. Open a video card's drawer (Seedance 2.0, about $1.89) and an image card's (Nano Banana
   Pro, about $0.14): the Cost line's unit should differ and read correctly in both.
4. Pick a paid model in the prompt box and move the ratio and tier: Seedream offers 2K/4K,
   Seedance 480p/720p/1080p, **Veo only 16:9 and 9:16 with no duration control**.
5. Two judgement calls waiting on you, both in the plan's Current State: FLUX 2 Pro's
   $0.015 displaying as "about $0.01" under the tested 2-decimal rule, and Seedance 2.0
   computing $1.89 against the plan's $2.07 headline.

## Not in this card

**Preview art** for the fifteen tiles. **Real enhancer recipes** for Seedream, Nano Banana
and Veo: nine models carry an explicit stand-in `enhanceRecipe` because a `type` with no
recipe silently resolves to `chroma`, which a test forbids. Each wants
`/create-enhancer-recipe` properly.

## Closed — 2026-09-21

**CI is green and it is the run that proves the fix.** `gh run view 35574612819 --json
conclusion` reads `success` on `2af8696d` (workflow *Tests*, 07:47–08:05Z). `ea154779` — the
MPI-831 spec fix for the red master four commits inherited — sits one commit BEFORE
`2af8696d` (08:46:38 against 08:46:53 local), so that run carries the fix rather than
predating it. Two further runs agree: `5f380c6a` (35574837883) and `610648bd` (35574969419),
both `success`. Master is green.

**Fabio approved the catalogue in the app on 2026-09-21** and the three things he raised were
handled rather than deferred silently: the price chip now takes Video orange on a clip model
(`2af8696d`), and the other two became MPI-864 (preview art) and MPI-865 (the picker), folded
into the MPI-849 umbrella as phase 3.

**Still open, and deliberately NOT changed by this card** — both are judgement calls for
Fabio, carried in the MPI-849 plan's Current State:

1. FLUX 2 Pro's true `$0.015` renders as "about $0.01" under `formatPrice`'s tested 2-decimal
   rule, understating by a third.
2. Seedance 2.0 at 5 s 1080p computes `$1.89` against the plan's `$2.07` headline — the
   plan's own recorded risk that the 1080p pixel dimensions are assumed, not measured.

Neither blocks the section, and neither is a regression; they are numbers awaiting a decision.
