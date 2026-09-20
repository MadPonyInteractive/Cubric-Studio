# MPI-831 — Flow Library: Third-party Flows, source badges, dimmed uninstalled tiles, paid tiles

**Umbrella:** MPI-560 phase 8. **Sibling:** MPI-841, which lists UNINSTALLED registry Flows in the same section. Both own `MpiFlowLibrary.js`, so they are sequenced, never parallel. This card goes first.

Answers **MPI-780 open question 1** (yes, show the paid Flows as link tiles). Decisions taken
by Fabio 2026-09-19 in session. Gumroad side is MadPony-Identity **MPI-81**, which owes this
card the two redirect URLs.

**Verify mode:** `user-ux` — every phase is a visual judgement in the app.

## Current State

**Phases 1, 2 and 3 are shipped and Fabio-verified. 1 and 2 are pushed (`3a27fc32`, red
fixed by `510e3a03`); phase 3 is verified but UNCOMMITTED — the working tree carries it.
Next action: phase 4, the two paid tiles.** MPI-81 still owes the two redirect URLs, and
the plan's standing answer is to ship the plain product URLs with a comment rather than
wait.

Phase 3 as built, in three places:

- `MpiTileSheet` grows a `dimmed` item key and an `el.setDimmed(id, bool)` — a sibling of
  the existing `setWaiting`, **not** a third argument on `patchState`. Nothing but the Flow
  Library sets `dimmed`, and widening the shared signature would hand three surfaces a
  parameter none of them mean. Opt-in throughout, exactly as phase 2 settled it.
- The CSS dims `.mpi-tile__thumb-media`, not `.mpi-tile__thumb`: the media flag sitting on
  top keeps phase 2's colour, because what a Flow MAKES does not change with whether its
  weights have landed.
- `_patchTile` sets chip AND class off one `flowAvailability` read, which is the trap.

**The seeded packages are GONE and phase 3 did not need them.** The profile under `%TEMP%`
was evicted again — `scratchpad/seed_packages.cjs` went with it — and the boot log said
`[userFlows] 0 package(s)`. It did not matter: the dim keys on availability, not on origin,
so the eight built-in `Get models` tiles exercise every path. **Phase 4 will need them
back**, and the seeder must be rewritten from the recipe in `## Plan Drift`.

What is already there, and matters:

- `MpiFlowLibrary.renderList()` sections by `mediaType` — `MEDIA_SECTIONS` (Image, Video,
  Audio) then an `Other` catch-all. `_block(items, label, icon)` renders one section.
- `MpiTileSheet` (Primitive) owns `TILE_FLAGS`: `featured` (gold sparkle) and `deprecated`.
  The Model Library passes `featured`; **the Flow Library passes no flags at all** —
  `_tileItem()` sends `id`, `name`, `media`, `preview`, `state`, `source` and nothing else.
- Availability is a chip only: `Ready` / `Get models` / `Licence required` / `Unavailable`,
  from `_badgeHtml()` over `flowAvailability()`. No visual difference on the thumb.
- `_patchTile()` → `sheet.el.patchState(id, html)` swaps **only the chip HTML**.
- A package Flow is identifiable by its id: the loader registers it as `user:<id>`
  (`docs/flow-packages.md`). That is the discriminator for phases 1 and 2 — no new field.

## Decided

- **The section is "Third-party Flows"** (Fabio, 2026-09-20, reversing his own call of the
  previous day — see `## Plan Drift`). The line it draws is **ships with the app / does
  not**, and the label carries a disclaimer: a Flow in this section is not ours to answer
  for when it misbehaves. Everything not built in goes here, our two paid packages
  included — raised and overruled, deliberately.
- It sits **at the bottom, across all media types**. Accepted consequence: a third-party audio
  Flow no longer appears under Audio, so the media sections stop being a complete view of
  the registry.
- **The coded Gumroad URL is never baked into the app.** The button opens
  `https://cubric.studio/flows/<id>`, which redirects to the coded Gumroad URL. The 100%-off
  code stays out of a public AGPL repo, where anyone could burn the hundred uses without
  ever opening the app, and it can be changed or retired without shipping a release.
- **No "N free left" counter.** It would need a Gumroad API token, which cannot ship in a
  public repo, and it is unconfirmed whether a product page exposes remaining uses at all.
  The buyer learns the price on the page, which is the moment it matters.

## Phase 1 — the Third-party Flows section

Split `visible` into built-ins and `id.startsWith('user:')` before the media loop. Media
sections render built-ins only; one `_block()` after them renders the third-party ones.

**Verify:** with a package installed, its tile appears only under Third-party Flows, the media
sections no longer list it, and a build with no packages looks exactly as it does today
(`_block` already no-ops on an empty list).

## Phase 2 — ~~the source flag~~ → the MEDIA flag — SHIPPED, built differently

A source flag was never built. Once the section existed, its header IS the source
statement, and a badge repeating it on every tile inside it would have said the same word
twice. What the section could not say is what any one of its tiles PRODUCES — it holds all
three media types at once, which is the one grid in the app whose header cannot answer
that. So the flag carries media instead.

- `TILE_FLAGS` grows three **opt-in** keys, `mediaImage` / `mediaVideo` / `mediaAudio`
  (`MpiTileSheet.js`). Opt-in is the whole safety story: the Model Library, the App Library
  and the model picker set none, so the shared primitive changed with no blast radius.
- `_tileItem()` sets one of them for package flows only, guarded by `MEDIA_SECTIONS` so an
  odd `mediaType` produces no flag rather than an invalid key.
- Colours mirror the media section headers exactly (video frost, audio warn) so a badge and
  a header read as one language. Image has no header colour of its own and the muted header
  ink is illegible on a thumb, so it takes `--ink-2`.

**Verified** 2026-09-20: live DOM shows flags on exactly the two package tiles and nowhere
else; Fabio confirmed in the app.

## Phase 3 — dimmed uninstalled tiles — SHIPPED

Desaturate the thumb of any tile that is not installed. The blast-radius question is
settled the way phase 2 settled it: a `dimmed` key the consumer opts into, so the Model
Library, the App Library and the model picker are untouched with no conditional anywhere.

The real work was never the CSS. Two things could each have shipped looking fine:

- **The patch path.** `_patchTile` swapped only the chip, so a finishing install would have
  left a grey thumb under a `Ready` badge until something forced a rebuild — and a rebuild
  is the one thing that path exists to avoid (MPI-235). It now sets both off one
  `flowAvailability` read, so the two cannot disagree.
- **The hover cascade.** `.mpi-tile:hover .mpi-tile__thumb-media` (0,3,0) outranks a plain
  `.mpi-tile--dimmed .mpi-tile__thumb-media` (0,2,0), so the base rule alone would have let
  the colour flood back under the pointer — the install state reading as a hover effect.
  The fix is a same-specificity `.mpi-tile--dimmed:hover` twin placed AFTER the hover rule.
  Hover moves brightness only; the grey is the state.

**Verified** 2026-09-20 (see `validation.md`): 0 chip/class mismatches across 13 tiles,
computed `filter` asserted during a real hover, and the un-dim proven to keep the SAME tile
element rather than rebuilding the grid.

## Phase 4 — the two paid tiles

Two hard-coded entries, rendered into the Third-party Flows section, each with title, preview,
one-line description and a **Get it** button in the drawer that opens the redirect.

- A paid, unbought Flow is a **fourth state**: not installed, not unavailable, purchasable.
  It needs its own chip. The `Get models` chip would be a lie.
- **The tile hides once a package with the matching id is installed**, or the user sees two
  Head Swaps after buying.
- Blocked on MPI-81 for the two URLs. Until they exist, use the plain product URLs and
  leave a comment.

**Verify:** the tile shows before install, the button opens the right page, and installing
the package replaces the link tile with the real Flow rather than adding a second one.

## Not in scope

- **A registry-fed list of third-party Flows — that is MPI-841**, not deferred. It was parked as
  1.7+ "advertising only" by MPI-532; Fabio pulled it into 2.0 on 2026-09-20 because a user
  who cannot see a third-party Flow in the app will never find it at all. This card builds
  the SECTION and the installed tiles; MPI-841 fills the same section with what is not
  installed. Hard-code the two paid tiles here anyway — they must work whether or not the
  registry answers.
- The registry's generated `index.json`. Also MPI-841, phase 1, and it lands in the registry
  repo rather than here.

## Plan Drift

- **2026-09-20 — the section is "Third-party Flows", not "Add-on Flows".** Fabio reversed
  his own call of the day before, at phase 1 pickup and before any code was written. The
  reason changed with it: the old label named DELIVERY to avoid mislabelling our own paid
  packages; the new one names RESPONSIBILITY, and the point is that a Flow which does not
  ship with the app is not ours to answer for when it breaks. The line the section draws
  is now **ships with the app / does not**, which is the same `user:` discriminator — only
  the string changed, so phase 1's code is unaffected.
- **2026-09-20 — phase 2 is a MEDIA flag, not a source flag.** Fabio approved phase 1's
  look but named the gap it opened: one flat section across all media types leaves no way
  to tell what any tile makes. He floated three fixes — repeat the sections per media, a
  heavier container, or a badge that lets the tiles mix back in. The badge slot was right,
  the mixing was not: it would have thrown away the separation he had insisted on twice.
  So: keep the section, badge the media. Repeating the sections stays the upgrade path when
  MPI-841 fills the section from the registry — three headers over two tiles is silly, over
  forty it is not.
- **2026-09-20 — phases 1+2 turned master RED, and the cause is the section's POSITION.**
  `tests/desktop/flow-packages.spec.js` timed out at 90s on all three attempts. Not a
  flake, not the runner: the tile thumb is `loading="lazy"`, and moving package tiles out
  of the media sections into a section at the BOTTOM put them ~2700px down against a 720px
  viewport. A below-fold lazy image never fetches, so the spec's
  `await new Promise(res => img.onload = img.onerror = res)` never settled — a HANG, not an
  assertion failure, which is why the log said nothing useful. Probed live: built-in tile
  `top 305 / complete true / naturalWidth 896`, package tile `top 2712 / complete false /
  naturalWidth 0`, and `scrollIntoView()` takes it to 896. Fixed in the spec (`510e3a03`),
  not in the product — a below-fold thumb SHOULD defer. **Phases 3 and 4 move these tiles
  again; anything that waits on a third-party tile's pixels must scroll it in first.**
- **Seed packages for a UI check** (`scratchpad/seed_packages.cjs`, 2026-09-20): the
  Third-party section does not render at all with no packages installed, so verifying it
  needs some. A valid package is a folder of `flow.json` + `workflow.json` + the preview
  file it names; build the manifest off the base in `tests/user-flows.test.cjs` (graph
  shape included), call `uf.validatePackage()` BEFORE writing so a rejection is a message
  rather than a missing tile, and copy a real `.webp` in so the thumb is not a broken
  image. Two packages of different media types is the right seed — the audio one is what
  proves it left the Audio section.
- **A `mv` of `user_flows` away and back NESTS it** (same session): the running app
  re-creates `user_flows/` the moment it scans, so moving the original back drops it
  INSIDE as `user_flows/user_flows_off`. It does not error — the section just renders one
  broken tile named after the folder. Move the package folders, not their parent.
- **2026-09-20 — phase 3 needed no packages, and the handoff said it did.** The dim keys on
  `flowAvailability`, not on `user:`, so every uninstalled built-in exercises it; the
  third-party tiles run the identical `_tileItem`. The seeded packages were gone again
  (`[userFlows] 0 package(s)`) and `scratchpad/seed_packages.cjs` had been evicted with
  them. Phase 4 DOES need them, so the seeder has to be rebuilt from the recipe above.
- **2026-09-20 — `js/components/types.js` was NOT updated, deliberately.** MPI-857 and
  MPI-859 both held fresh write claims on it. Its `MpiTileSheetItem` typedef was already
  three keys behind (phase 2 never updated it either) and is now four, plus `setDimmed` is
  missing from the instance-method list. Carried as a checklist item, to be done when the
  claims clear — it is one docblock, and fighting two live peers over it is not worth a
  merge conflict.
- **Raised and overruled:** phase 4's two paid tiles are Mad Pony products, so
  "Third-party Flows" sits over the only two Flows we take money for. Worse, the code
  cannot separate them — post-install a Mad Pony package and a stranger's are both
  `user:<id>`, and telling them apart would need a publisher field on the package
  manifest, a contract change this card avoids. Fabio's answer: one section, everything
  not built in goes in it. Do not re-raise it; if the disclaimer ever needs to exclude our
  own products, that is a publisher field and a new card.

## Completed

- **Phase 1 — the Third-party Flows section.** `renderList()` partitions `visible` on
  `USER_FLOW_PREFIX` ahead of BOTH loops (the media loop and the `Other` catch-all), so an
  odd `mediaType` lands in the section rather than leaking into `Other`. One `_block()`
  after them, icon `cube`, no CSS needed — `--cube` has no rule and inherits the base
  header colour exactly as `--image` does.
- **Phase 2 — the media flag** (see the phase, built differently from the plan).
- **Phase 3 — dimmed uninstalled tiles.** Opt-in `dimmed` key + `setDimmed()` on the
  primitive, `_tileItem` setting it from `flowAvailability`, `_patchTile` toggling chip and
  class together, and the same-specificity hover twin that keeps the grey under the pointer.
  Fabio-verified 2026-09-20 in the real Electron window; evidence table in `validation.md`.

Proven 2026-09-20, in an isolated instance with two seeded packages:

| Check | Result |
|---|---|
| Two packages, one image + one audio | `Image 5 · Video 3 · Audio 5 · Third-party Flows 2` |
| The audio package under Audio? | No — it is only in the section |
| Zero packages | `Image 5 · Video 3 · Audio 5`, no header, identical to before |
| Flags on non-package tiles? | None, on any of the four surfaces |
| eslint · `tests/user-flows.test.cjs` | clean · 14/14 |
| Fabio's own check | Approved (both phases) |

## Ownership

```
js/components/Organisms/MpiFlowLibrary/MpiFlowLibrary.js
js/components/Organisms/MpiFlowLibrary/MpiFlowLibrary.css
js/components/Primitives/MpiTileSheet/MpiTileSheet.js
js/components/Primitives/MpiTileSheet/MpiTileSheet.css
js/components/types.js
tests/desktop/flow-packages.spec.js
docs/flow-packages.md
```

`MpiTileSheet` and `types.js` are contested — peers have had live claims on neighbouring
component files all week. Claim before the first write and re-read `state/index.json` at
pickup.
