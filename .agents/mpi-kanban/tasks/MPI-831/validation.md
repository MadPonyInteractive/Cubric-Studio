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

**Not yet done:** the `types.js` typedef sync, and moving the `--purchase` chip into
`MpiTileSheet.css` once MPI-853's claim clears (message `86e7cdf6`). Both are blocked on
live peer claims, neither is phase work. The card stays in `doing` at `validating` until
they land and the work is committed.
