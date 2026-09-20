# MPI-831 — Flow Library: Add-on Flows, source badges, dimmed uninstalled tiles, paid tiles

**Umbrella:** MPI-560 phase 8. **Sibling:** MPI-841, which lists UNINSTALLED registry Flows in the same section. Both own `MpiFlowLibrary.js`, so they are sequenced, never parallel. This card goes first.

Answers **MPI-780 open question 1** (yes, show the paid Flows as link tiles). Decisions taken
by Fabio 2026-09-19 in session. Gumroad side is MadPony-Identity **MPI-81**, which owes this
card the two redirect URLs.

**Verify mode:** `user-ux` — every phase is a visual judgement in the app.

## Current State

Nothing built. Four related changes, all in one component pair, so they ship as one pass
rather than four cards fighting over the same file.

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

- **The section is "Add-on Flows"**, not "Third-party flows". It names delivery, not
  authorship: Head Swap and DramaBox are Mad Pony Flows sold as packages, and a
  third-party label would be a lie about our own products.
- It sits **at the bottom, across all media types**. Accepted consequence: an add-on audio
  Flow no longer appears under Audio, so the media sections stop being a complete view of
  the registry.
- **The coded Gumroad URL is never baked into the app.** The button opens
  `https://cubric.studio/flows/<id>`, which redirects to the coded Gumroad URL. The 100%-off
  code stays out of a public AGPL repo, where anyone could burn the hundred uses without
  ever opening the app, and it can be changed or retired without shipping a release.
- **No "N free left" counter.** It would need a Gumroad API token, which cannot ship in a
  public repo, and it is unconfirmed whether a product page exposes remaining uses at all.
  The buyer learns the price on the page, which is the moment it matters.

## Phase 1 — the Add-on Flows section

Split `visible` into built-ins and `id.startsWith('user:')` before the media loop. Media
sections render built-ins only; one `_block()` after them renders the add-ons.

**Verify:** with a package installed, its tile appears only under Add-on Flows, the media
sections no longer list it, and a build with no packages looks exactly as it does today
(`_block` already no-ops on an empty list).

## Phase 2 — the source flag

One new entry in `TILE_FLAGS` and one line in `_tileItem()`. Pick an icon from
`js/utils/icons.js`; do not reuse `sparkle`, which already means Featured on the Model
Library and would read as an editorial endorsement.

**Verify:** the flag shows on package tiles, not on built-ins, and never overlaps another
flag (the stacking column already handles that).

## Phase 3 — dimmed uninstalled tiles

Desaturate the thumb of any tile that is not installed. The CSS is trivial; the work is
that `patchState` must toggle a class on the tile, or a finishing install leaves a grey
thumb under a `Ready` chip.

`MpiTileSheet` is shared by the Model Library, the App Library and the model picker, so
decide the blast radius before writing: either all surfaces get it (preferred, consistent)
or the class is set by the consumer and only the Flow Library opts in.

**Verify:** install a Flow's models and watch the thumb regain colour **without a full grid
rebuild** — `_patchTile` is the path, and MPI-235 is why it must stay a patch.

## Phase 4 — the two paid tiles

Two hard-coded entries, rendered into the Add-on Flows section, each with title, preview,
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

- **A registry-fed list of add-on Flows — that is MPI-841**, not deferred. It was parked as
  1.7+ "advertising only" by MPI-532; Fabio pulled it into 2.0 on 2026-09-20 because a user
  who cannot see a third-party Flow in the app will never find it at all. This card builds
  the SECTION and the installed tiles; MPI-841 fills the same section with what is not
  installed. Hard-code the two paid tiles here anyway — they must work whether or not the
  registry answers.
- The registry's generated `index.json`. Also MPI-841, phase 1, and it lands in the registry
  repo rather than here.

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
