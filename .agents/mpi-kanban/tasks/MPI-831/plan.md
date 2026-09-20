# MPI-831 — Flow Library: Third-party Flows, source badges, dimmed uninstalled tiles, paid tiles

**Umbrella:** MPI-560 phase 8. **Sibling:** MPI-841, which lists UNINSTALLED registry Flows in the same section. Both own `MpiFlowLibrary.js`, so they are sequenced, never parallel. This card goes first.

Answers **MPI-780 open question 1** (yes, show the paid Flows as link tiles). Decisions taken
by Fabio 2026-09-19 in session. Gumroad side is MadPony-Identity **MPI-81**, which owes this
card the two redirect URLs.

**Verify mode:** `user-ux` — every phase is a visual judgement in the app.

## Current State

**Phases 1 and 2 are shipped and Fabio-verified (2026-09-20). Next action: phase 3, the
dimmed uninstalled tiles.** Nothing is committed yet — the working tree carries the change.

Phase 3 starts from a decision the plan still leaves open: `MpiTileSheet` is shared by the
Model Library, the App Library and the model picker, so decide the desaturation's blast
radius BEFORE writing. Phase 2 set the precedent and it should be followed — the media
flags are **opt-in keys the consumer sets**, so the other three surfaces were untouched
without a single conditional. The same shape works for the dim: a class the consumer asks
for, not a rule every tile sheet inherits.

**Verifying phase 3 needs installed packages, and the seeded ones DO NOT last.**

- Two valid packages go in `%TEMP%\cubric-agent-profile\user_flows\` (`seed-image-flow`,
  `seed-audio-flow`), built by `scratchpad/seed_packages.cjs` — the recipe is in
  `## Plan Drift`, and rebuilding takes one command.
- **Expect them to be gone.** The agent profile lives under `%TEMP%`, and it was wiped and
  rebuilt from scratch mid-session on 2026-09-20 (every file in it restamped within one
  minute). `npm run app:isolated` reuses the profile PATH, not its contents. Check
  `GET /user-flows` returns both before trusting a Library screenshot — an empty result and
  a correctly-absent section look identical.
- Both preview off ONE file, so the two tiles look identical. That is the seed, not a bug.

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
