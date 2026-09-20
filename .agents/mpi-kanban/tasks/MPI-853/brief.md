# MPI-853 — the Paid models section

**Umbrella:** MPI-849 phase 2. Needs MPI-851 (the `provider` discriminator and the install
gates) and MPI-850 (the price to display).

**Verify mode:** `user-ux`.

## What Fabio asked for

A section at the **foot** of the Model Library listing the paid models, each showing its price
and stating that it needs a DeepInfra key in the remote settings.

## The precedent to copy verbatim

`_pluginSection()` (`MpiModelManager.js:1306-1316`) — a third, non-model section appended
after the two model sections, deliberately outside the media and tier filters and outside the
"N available" count. **Section order is literal call order in `renderList()`**; there is no
ORDER table.

Four additive edits: exclude paid from `visible` (`:1336`) and from the counts (`:1348`); add
`_paidSection()`; call it at `:1366` **and** at `:1360` inside the empty branch, the two call
sites plugins occupy — miss the second and the section vanishes on any search matching no
local model; append a paid segment to `_listSignature()` or the chip never repaints when a key
is saved.

## The tile

`MpiTileSheet` is **state-dumb by contract** — the consumer hands the bottom row over as an
HTML string. Build the item **without calling `_modelState`**: its fallthrough renders an
`Install` chip, and `_install` is `if (!dependencies.length) return;` — so the click does
**nothing**, silently, which reads as a download-manager bug.

Add a new `.mpi-tile__chip--paid` modifier. **Do not reuse `--available`** — its `::before`
literally draws a download arrow on something that never downloads. Colours from CSS vars.
`js/utils/icons.js` has no key or currency glyph; add one there rather than inlining SVG.

The prerequisite pattern to copy is `_needsLicenceProof` — derived state, never stored,
changing exactly two surfaces. `docs/model-library.md:158-180` makes the argument in as many
words: *"Install… promises a download and delivers a legal wall."*

## What must not break

- **The hero count** inflates on both numerator and denominator (`heroStats.js:65`).
- **The orphan sweep is SAFE — do not touch it.** It keys on `DEPS`, not `MODELS`, and the
  guard already filters depless models on both engines. The docs' prohibition is against
  *deleting* a dep entry, a different edit. A second notion of "orphan" is how MPI-310
  destroyed 5.24 GB; the correct edit is upstream.
- **Two fleet audits bind every new ModelDef:** `tests/recipe-registry.test.cjs` (the
  `enhanceRecipe ?? type` must resolve) and `tests/agent-corpus.test.cjs` (a
  `docs/agent/models/<recipeId>.md`, and every `t2i` model listed in the corpus).
- **Dep-graph edits are not live until the server restarts** — a Ctrl+R reload does not clear
  `createRequire`'s cache of `models.js`.

## The no-engine gate is NOT this card's problem

`js/shell.js:486` gates the library shut with no engine, and it is tempting to lift it here.
**Do not.** `blockedByNoEngine()` guards six call sites and two of them are *creating* and
*opening a project* (`js/shell/projectUI.js:261`, `:557`), so a user without ComfyUI cannot
reach a project at all — lifting one gate would drop them into an app where every local model,
Flow and canvas tool fails at the point of use.

Fabio's call, 2026-09-20: that is its own job. **Carved out to MPI-856.** This card ships the
paid section for users who already have ComfyUI, and leaves the gate exactly as it is.

## Also settle

`gemini-3-pro-image` and `nano-banana-pro` are **the same model under two ids** — identical
pricing and fields, and the Gemini card calls itself Nano Banana Pro. Two tiles for one thing.
Ship one and alias the other, or label the pair.

## Verify

The section renders at the foot with a price per tile and no Download control; the hero count
is unchanged by adding a paid model; the section still renders on a search matching no local
model; the chip repaints when a key is saved without reopening the library; `npm test` green.
