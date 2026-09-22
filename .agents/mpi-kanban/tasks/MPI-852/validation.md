# MPI-852 — validation

## What shipped

A price column in the prompt box, `#price-tag-slot`, immediately before `#bottom-right-slot`.
It shows what the next run will cost when the selected model bills the user's own account,
and is hidden for every local model. The figure is `estimateCost().display` verbatim.

The number is derived by `estimateRunCost()` in `cloudExecutor.js`, which prices what
`buildSizeFields()` will actually SEND rather than what the controls hold — a size outside a
model's published bounds is fitted on the way out, and the fitted size is what gets billed.
`runCloudCommand` now builds its own POST body from the same `cloudRunFields()`, so the run
that is quoted and the run that is dispatched cannot be two different runs.

## A money bug found on the way, and fixed

`cloudExecutor` read the duration as `params.Duration`. **Nothing in this app has ever
written that key** — the duration control injects `Input_Duration`
(`PromptBoxControls.js:623`, and `generationControls.js:484` for the agent path). So since
MPI-851 shipped, **every cloud video generation was dispatched with no duration at all**:
`buildSizeFields` omitted the field, the provider ran its own default clip length, and the
user was billed for that instead of for the clip they asked for.

Found because the price tag could not price a video at all. Fixed in the same function;
`tests/cloud-price-tag.test.cjs` pins the key, and the guard was proven RED against the
shipped `params.Duration` and green after.

## What the brief got wrong, re-measured

The brief predates MPI-851/853/875. Four of its premises are false against the shipped code
and building to them would have shipped bugs — the reasoning is in `checklist.md` § 0. The
one that mattered most: **"hide or zero when `state.engineOverride === 'local'`" would have
hidden a real charge.** `generationService.js:96` routes on `model.provider` before
`forceLocal` is read, and `:961` forces `forceLocal: false` for a cloud model, so the
Run-locally toggle cannot divert a cloud run. The tag is not gated on it.

## Evidence

`npm test` — 1723 tests, 1721 pass, 0 fail, 1 todo (MPI-867's, declared).
`npm run lint:components` — clean. `eslint` clean on all four changed files.

`tests/cloud-price-tag.test.cjs`, 13 tests, each proven RED before the code that makes it
green (three separate back-outs, one at a time):

| backed out | what went red |
|---|---|
| `sent.width/height` → `want.width/height` | out-of-bounds sizes quoted at 4x the real bill |
| `grid-template-columns` 8 tracks → 7 | the column count guard |
| `Input_Duration` → `Duration` | the duration key, and the whole-roster quote |

**Live, in a real renderer** (`npm run app:isolated`, real `MpiPromptBox` mounted, real
stylesheets, port 60289, 2026-09-21):

| model | tag |
|---|---|
| `krea2` (local) | hidden, empty |
| `nano-banana-pro-cloud` | about $0.14 |
| `nano-banana-2-cloud` | about $0.07 |
| `flux-schnell-cloud` | about $0.0005 |
| `veo-31-cloud` | about $1.20 at its saved tier, about $3.20 at 720p |
| back to `krea2` | hidden again |

Layout, measured on the live bar: 8 grid tracks resolve, the price column is 73 px and sits
between the engine toggle and the run cluster, bar height 63 px unchanged, `scrollWidth -
clientWidth` = 0 — the ninth element did not reflow or overflow the bar.

**It moves.** Driving the REAL duration slider on `seedance-15-pro-cloud` through the real
`settings:*` event path: 4 s → about $0.05, 8 s → about $0.10, 12 s → about $0.15, linear as
the formula says. It survives an op switch (t2v → i2v, still about $0.05), which is the
`_refreshOpSlot` rebuild the brief warned about.

The estimate still reproduces the one real charge we have: Nano Banana 2 at 1 MP quotes
$0.067296 against the $0.067257 DeepInfra billed on 2026-09-20 — 0.06% high, the direction
Fabio asked for.

## Two things left, and both are known

- **The batch multiply is proven arithmetically, not live.** The unit test pins it (Veo,
  1 → 4 cards is $3.20 → $12.80, clamped at the provider's published max of 4). It was not
  driven through the UI because no batch control mounted in the standalone harness; it
  persists through `settings:shared:update`, which is the same event path the duration
  slider exercised live above.
- **Fabio's own look is the remaining check** (`verify mode: user-ux`): does the tag read
  right sitting beside CUE, and is "about $0.14" the wording he wants there.

## Noticed, not fixed — belongs on its own card

The duration slider offers **1–30 seconds** on `seedance-15-pro-cloud`, whose published
range is **4–12**. `buildSizeFields` clamps, so nothing breaks and nothing is over-billed
against the pick — but a user who drags to 30 gets a 12 s clip with no indication that the
control lied to them. The clamp is correct; the control's range is not.

## Fabio's look, 2026-09-21 — FAILED

His words, verbatim:

> "Considering your UI pricing, it's not looking good."

So the user-ux check this card was held for did NOT pass. The arithmetic, the wiring and
the seam are all proven and stay; what is rejected is how the tag LOOKS sitting in the bar.
A muted `--ink-2` caption in `--t-xs` between the model button and CUE is not it.

The card goes back to `in-progress`. The redesign is the next session's first job and
Fabio has named the tool for it: **run the `impeccable` skill on the price tag.** He asked
explicitly that it not be started in this session.

Nothing below the presentation layer is in question — do NOT re-derive `estimateRunCost`,
the `cloudRunFields` seam, the `Input_Duration` fix or the event wiring. They are green,
pushed (8c74a29e, CI 35597739341 success) and independently guarded by
`tests/cloud-price-tag.test.cjs`.

## Placement A1 built, 2026-09-21 — automated checks GREEN, Fabio's look pending

The restyle-in-place (90410216) was rejected a SECOND time, and the criticism was
placement, not styling: the tag had inherited its own column from the first rejected
design and nothing had ever questioned it. Four placements were mocked in the live bar and
Fabio chose **A1 — the estimate inline INSIDE the Cue button**, `CUE | ABOUT $0.14`.
That is what is now built.

**What changed (4 edits, 3 files):**

- `MpiPromptBox.js` — the `#price-tag-slot` column div is DELETED. The price span is now
  created inside `_renderRunCluster` and appended to `runBtn.el`, after `fillEl`; it must
  be created there because that function clears the slot with `innerHTML` on every
  queue-count change, and it survives a `Cue x2`/`Loop x3` relabel because `setLabel` only
  rewrites `.mpi-ibtn__label`. `_refreshPriceTag()` is called at the end of the same
  function, or the span comes back blank after every rebuild.
- `MpiPromptBox.js` — `_refreshPriceTag` targets `qs('.mpi-prompt-box__price', el)` and
  sets `textContent`, still toggling `hide` rather than emptying the string: the span
  draws its own separator rule, and an empty one would leave that rule hanging beside CUE.
- `MpiPromptBox.css` — grid drops from 8 tracks to 7, the track comment is corrected, and
  `.mpi-prompt-box__col--price` is gone. The in-button treatment replaces the recessed
  pill: no fill, no radius, no min-height, because it is no longer its own object.
- `tests/cloud-price-tag.test.cjs` — the structural test is rewritten to pin the new
  invariant. The other 12 arithmetic tests did not move.

**Verified:**

- `node --test tests/cloud-price-tag.test.cjs` → **13/13 pass**.
- Every test referencing MpiPromptBox (19 files) → **159 tests, 158 pass, 0 fail**, 1
  pre-existing todo.
- `npm run lint:components` → **clean**. (It caught one real error first: the new template
  comment used backticks inside a template literal — `Unexpected token CUE` — exactly what
  the comment three lines above it warns about.)
- **The rewritten test was proven RED against HEAD's blobs**, assertion by assertion, so it
  pins something: span-created-in-cluster RED, price-column-gone RED, armed-rebind RED, and
  a MIXED tree (new 7-column JS + HEAD's 8-track CSS) RED on `8 !== 7`. Working tree GREEN.
- **Rendered and measured** on a static page serving the REAL stylesheets over http, seven
  states: rest, a long figure ($12.80), a sub-cent figure ($0.0005), a batch relabel
  (`Cue x4`), armed (`Loop x3`), local-model-no-price, and armed-no-price. Button height
  **34 px in all seven** (the bar stays 63 px), `scrollWidth - clientWidth` **0 in all
  seven**, and the two no-price cases collapse back to a clean `CUE` with no orphan
  separator.

**The armed state was the trap the handoff flagged, and it is closed.** Armed fills the
button solid with `--accent-heat`; the existing rule rebinds only `.mpi-ibtn__label`, so a
price left at `--ink-2` would have shipped warm grey on solid accent. Measured after the
fix: armed price `oklch(0.16 0.02 0)` = `--ink-on-accent`, identical to the label. The
separator is a `currentColor` pseudo-element at 0.35 opacity, so it follows the text into
the armed state without a rebind of its own. The armed rule is three classes AND later in
the file than the hover rule, so armed-and-hovered needs no selector.

**One claim in the first draft of the CSS comment was wrong and is corrected in place:**
it said the price takes `--ink-2` because that is the label's colour, "one object, one
voice". It is not — `.mpi-prompt-box__col .mpi-ibtn__label` pins the label to
`--accent-heat` (measured `oklch(0.76 0.17 355)` in Vision). The two-tone split is the
actual design: accent = the action, ink = the readout. `formatPrice` was not touched;
"about" stays.

**Still Fabio's call** (`verify mode: user-ux`): does `CUE | ABOUT $0.14` read right in
the running app, on a real paid model, as duration/batch/references move it.

## Noticed, not fixed — the cloud models' quality tiers render as `undefined`

Fabio spotted this mid-session, on the video models: the QUALITY radio in the prompt box
shows three options all labelled `undefined`.

Not this card, and not a mystery. `QUALITY_LABELS` in
`js/components/Compounds/MpiOptionSelector/MpiOptionSelector.js:134-143` is a hardcoded
id→label map holding `very_low … very_high`, `1k`, `2k`, `4k`. MPI-850/851 added cloud
models declaring tier ids that are not in it — `['480p','720p','1080p']`
(`models.js:2134,2176,2201`) and `['1.5k','2k']` (`models.js:1971`) — and
`_buildQualityOptions` renders `QUALITY_LABELS[t]` straight into the option label, so a
missing key prints the word `undefined`. The comment on line 140 records this exact
failure happening once before, for Krea2's `1k`.

It belongs to the MPI-849 umbrella's phase 1 (the cloud catalogue), not to the price tag.

## Closed 2026-09-22

Both gates are met.

- **Fabio's eyes** (`verify mode: user-ux`): he signed placement A1 off in the running app,
  on a real paid model, with `1`. Nothing outstanding on his side.
- **CI**: run `35694132707` on `3e2af47a` came back `conclusion: success`. That run carries
  `bc616327`, the A1 code commit (the earlier green run `35693471780` on `6710f45c` only
  unblocked the push and does not carry it).

Card moves `doing/validating -> done/complete`. No code changed at close-out.

