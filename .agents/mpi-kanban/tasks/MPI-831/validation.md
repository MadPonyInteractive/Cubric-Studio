# MPI-831 Validation

**Verify mode:** `user-ux` — every phase is a visual judgement in the app. The check runs in
an isolated instance (`npm run app:isolated`, own profile + own port + `APP_DOCUMENTS`),
never the user's live `:3000`.

## Phases 1 and 2 — VERIFIED 2026-09-20

**Fabio's own check, in the app:** approved. He raised one gap against phase 1 (a flat
section leaves no way to read a tile's media type), which phase 2 then closed as a media
badge rather than the planned source badge; he approved that too.

**Seed:** two valid packages in the agent profile, `seed-image-flow` and `seed-audio-flow`.
The audio one is the load-bearing half — it is what proves a package leaves its media
section.

| Check | Command / method | Result |
|---|---|---|
| Section renders, both media types | live DOM, isolated instance | `Image 5 · Video 3 · Audio 5 · Third-party Flows 2` |
| Audio package absent from Audio | same | Audio holds only the 5 built-ins |
| No packages → unchanged grid | packages removed, reload | `Image 5 · Video 3 · Audio 5`, no header |
| Media flags on package tiles only | live DOM, all tiles | `mediaAudio` + `mediaImage` on the two; nothing elsewhere |
| Shared primitive's other 3 surfaces | opt-in keys, none set | untouched by construction |
| Lint | `npx eslint` on both changed files | clean |
| Unit tests | `node --test tests/user-flows.test.cjs` | 14/14 |

## Phase 3 — dimmed uninstalled tiles — VERIFIED 2026-09-20

**Fabio's own check, in the app:** approved ("that's working"), looking at the real Electron
window on the isolated instance — the video row and the audio row, with the Song drawer open
over a dimmed tile.

Checked in an isolated instance on port 63525 (profile `%TEMP%\cubric-agent-profile`), driven
with `playwright-cli`. **No packages seeded** — `[userFlows] 0 package(s)` in the boot log —
and none needed: the dim is keyed on availability, not on where a Flow came from, so the
eight built-in `Get models` tiles exercise it. The third-party section's own tiles run the
identical `_tileItem` path.

| Check | Method | Result |
|---|---|---|
| Dim tracks the chip, never disagrees | all 13 tiles, `(chip === 'Ready') === dimmed` | 0 mismatches |
| Dimmed thumb, resting | computed `filter` | `grayscale(0.85) brightness(0.72)` |
| Ready thumb, resting | computed `filter` | `saturate(0.92) brightness(0.92)` |
| **Grey survives hover** | real `hover`, `:hover` asserted true | `grayscale(0.85) brightness(0.88)` — and `scale(1.04)` still applies |
| Install finishes → colour returns | `state.s_installedModelIds` += the flow's models | `dimmed` false, chip `Ready` |
| **…without a grid rebuild** | element identity across the patch | `sameElement: true`, a property set on the node survived |
| Reversible | state restored | back to `dimmed` / `Get models` |
| Lint | `npx eslint` on both changed files | clean |
| Unit tests | `node --test tests/user-flows.test.cjs` | 14/14 |
| The spec this card broke once | `tests/desktop/flow-packages.spec.js` | 4/4 in 36.7s |

The hover row is the one that could have shipped broken and read as fine:
`.mpi-tile:hover .mpi-tile__thumb-media` outranks a plain `.mpi-tile--dimmed …` on
specificity, so without the same-specificity twin placed after it the grey would lift under
the pointer. Asserted on a computed style during a real hover, not by reading the stylesheet.

## Phase 4 — the two paid tiles — AUTOMATED CHECKS PASS, awaiting Fabio 2026-09-20

Checked in an isolated instance on port **58656** (profile `%TEMP%\cubric-agent-profile`,
scratch `APP_DOCUMENTS`), driven with `playwright-cli`; closed after Fabio's check, so the
port is dead — relaunch with `npm run app:isolated` to re-walk any of this. The seeded
`drama-box` was deleted from the profile during that check and the profile itself survives
under `%TEMP%` until the next eviction. Both halves ran against ONE boot:
first with `GET /user-flows` returning `{"flows":[]}`, then with the **real** `drama-box`
package seeded from `c:\AI\Mpi\Cubric-Flows\drama-box` (`minAppVersion` nudged to `1.0.0` on
the copy only) and confirmed by `GET /user-flows` → `[{id: drama-box, errors: []}]` before a
single pixel was trusted.

| Check | Method | Result |
|---|---|---|
| Both paid tiles render, in the right section | live DOM | `Image 5 · Video 3 · Audio 5 · Third-party Flows 2` |
| Media flag per paid tile | live DOM | Head Swap `mediaImage`, DramaBox `mediaAudio` |
| Paid tile is dimmed like any uninstalled one | computed `filter` | `grayscale(0.85) brightness(0.72)` |
| The chip resolves, and is the ACTION colour | computed `color` on `--purchase` | `oklch(0.78 0.028 80)` = `--accent-heat` |
| The chip's glyph | computed `::before` `content` | `"↗"` — not the `↓` of `Get models` |
| **Thumbs are real pixels, not a lazy stall** | `scrollIntoView()` then `naturalWidth` | `896` on both, `complete: true` |
| Drawer: art, name, line, one button | live DOM after a real tile click | hero `naturalWidth 896`; buttons `[close, "Get it"]` |
| **Get it opens the redirect, not Gumroad** | `window.open` stubbed, button clicked | `https://cubric.studio/flows/head-swap` |
| **Install REPLACES the advert** | seed `drama-box`, click the UI's own Refresh | DramaBox ×1, chip `Ready` |
| **…and does not duplicate it** | same pass | section still `2`, total tiles still `15` |
| Head Swap unaffected by the other's install | same pass | still `Get it` |
| Lint | `npx eslint` on the changed organism | clean |
| Unit tests | `node --test tests/user-flows.test.cjs` | 14/14 |
| Desktop spec for this surface | `npm run test:desktop -- tests/desktop/flow-packages.spec.js` | 4/4 in 36.4s |

The duplication row is the one that could have shipped looking fine: the advert and the
bought package are the same Flow under two ids (`head-swap` vs `user:head-swap`), so nothing
but the explicit `user:` check stops a buyer seeing two Head Swaps. Asserted on the section
count AND the total, because hiding the wrong tile would have kept one of those honest.

**Fabio's own check, in the app: APPROVED** 2026-09-20, in the real Electron window on the
isolated instance. He ran the harder of the two states — deleted the seeded `drama-box` and
hit Refresh, so the grid showed `8 installed` and **both** paid tiles side by side under
`THIRD-PARTY FLOWS 2`, Head Swap dimmed with its image flag and DramaBox dimmed with its
audio flag, both chipped `↗ GET IT`. He then opened the DramaBox drawer: hero art, the
one-line description, `THIS FLOW IS SOLD SEPARATELY`, and a single full-width `GET IT`.

That pass is worth more than the seeded one it followed, because it is what every user sees
before they have bought anything — and it exercised the delete→Refresh path, which is the
same `renderList()` that has to put the advert BACK when a package goes away.

## The two follow-ups — landed 2026-09-21, `04b2b0bb`

Both were blocked on live peer write claims, not on work. All of them cleared overnight:
MPI-857 (`4521ef17`) `released`, MPI-859 (`c964cf70`) `verified`, MPI-853 (`9b973c12`,
`baacdcc8`) `released` 08:18Z, and MPI-871 (`7cb48bdd`) let go of `types.js` at 10:37:32Z —
that record's `status` is `verified`, not `released`, but it carries `released_at` and
`released_paths` and the file is absent from the index. `index.json`'s `active_file_claims`
held four records at that point and none of them named either file, which is the authority —
not the heartbeats, and not a record's own `status` word.

Two corrections the claim auditor caught in this card's own prose, recorded rather than
quietly fixed: `04b2b0bb`'s message says the chip moved "beside its four siblings" — there
are **five** (`--installed`, `--available`, `--partial`, `--paid`, `--unavailable`), because
MPI-853's `--paid` landed after the checklist item was written; and that same message calls
MPI-871's claim `released` when the record says `verified`. Neither changes what shipped.

| Check | Method | Result |
|---|---|---|
| The chip rule now lives with its siblings | `MpiTileSheet.css`, unscoped, declarations unchanged | moved beside `--installed/--available/--partial/--paid/--unavailable` |
| Nothing can outrank the lower specificity | `grep` for `mpi-tile__chip` across `js/` + `styles/` | **no rule outside `MpiTileSheet.css`**, and every rule there is a single-class modifier |
| `--purchase` and `--unavailable` never co-occur | `_flowState()` / `_paidTile()` | two different branches (`MpiFlowLibrary.js:266` vs `:327`) |
| The typedef matches the component | against `MpiTileSheet.js`'s own docblock | `cloud`, `dimmed`, `mediaImage`, `mediaVideo`, `mediaAudio` added; `setDimmed` added to the method list |
| Lint | `npx eslint` on both component dirs + `types.js` | clean |
| **Both specs for the surface, not just the one named like the card** | `npm run test:desktop -- tests/desktop/flow-packages.spec.js tests/desktop/flow-library-filters.spec.js` | **5/5 in 46.1s** |
| CI on the commit itself | run `35590645127` on `04b2b0bb` | **`completed / success`** — read from `conclusion`, never from a piped `gh run watch` exit code |

`flow-library-filters.spec.js` is in that run deliberately: it is the spec that counts
`.mpi-tile__chip--purchase` elements per filter, and it is the one phase 4 shipped red by
verifying against `flow-packages.spec.js` alone. The class name did not change here, so the
count could not move — but the cheap proof is running it, not reasoning about it.

The one thing a cascade grep cannot prove is the rendered colour, and that was already
proved on the parked rule: `oklch(0.78 0.028 80)` with the `↗` glyph, in Fabio's own
Electron window above. Moving a rule to a file with no competing selector cannot change it.
