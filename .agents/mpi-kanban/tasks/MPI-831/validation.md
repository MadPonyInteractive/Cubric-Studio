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

**Not yet done:** phase 4, and the `types.js` typedef sync. The card stays in `doing`.
