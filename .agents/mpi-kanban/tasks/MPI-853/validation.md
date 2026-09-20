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

## Not in this card

**Per-model ratios and supported resolutions.** FLUX Schnell (Cloud) inherits the built-in
`flux` table and its dimensions are inside what the endpoint accepts (128-1920, verified
live: a 4:5 request came back 896x1088 exactly). Getting this right for the other fourteen
is part of adding them, and DeepInfra publishes the answer per model in `in_fields` on the
keyless catalogue — so the honest way is to capture those limits into
`dev_configs/deepinfra-prices.json` and derive each model's ratio table from them rather
than hand-writing fifteen tables.
