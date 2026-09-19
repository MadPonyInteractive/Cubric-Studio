# MPI-759 Validation

## 2026-09-15 - MPI-757 Batch 1, verified by the orchestrator

| Check | Command | Result |
|---|---|---|
| Kind + rendition tests | `node --test "tests/asset-kinds.test.cjs" "tests/gallery-renditions.test.cjs"` | 20/20 pass (orchestrator re-run) |
| Desktop specs | `npx playwright test --config=playwright.desktop.config.js tests/desktop/gallery-gif-hover.spec.js tests/desktop/gallery-renditions.spec.js tests/desktop/gallery-media-release.spec.js --output=C:/Users/Fabio/AppData/Local/Temp/claude/C--AI-Mpi-Cubric-Vision/ea60c208-a8e9-4194-8707-66e50bd6ce43/scratchpad/orch-pw` | 10/10 pass (orchestrator re-run) |
| Component lint | `npm run lint:components` | clean |
| Full node suite | `node --test "tests/*.test.cjs"` | 1089 pass, 0 fail, 1 skipped |
| Bite check (worker) | comment out `if (isGif && !opts?.userHover) return;` in `_promoteVideo` | both new spec tests RED, restored, green |

Integration fix (orchestrator): the new kind broke `tests/gallery-filter.test.cjs` fixtures. The
description line now expects `'GIFs, Videos, 3D Scenes · Favs'`, and the all-hidden line hides `gif`
too. The worker's message named only the first; the second was masked because `strictEqual` stops at
the first failing assert. Message c47371bc resolved.

**NOT RUN, close gate open:** the hover-tour VRAM number on the MPI-633 rig. Those rigs
(`tests/desktop/_mpi633-*.rig.js`, `gpusnap.ps1`) were deleted at MPI-633's close-out, and the standard
desktop harness launches with `--disable-gpu`, so it reads 0.0 MB. No number exists. Fabio decides:
rebuild a VRAM rig in scope, or waive it for v1 (hover bounds the decode to cards actually hovered,
decision 5).

## 2026-09-16 - VRAM gate WAIVED for v1 (Fabio, in chat)

Fabio waived the hover-tour VRAM number. Hover bounds the decode to the cards actually hovered, and
the specs above prove only the hovered card mounts the `.gif`. The real-world check comes after
MPI-757 finishes, on Fabio's mascot project (93 animation assets to convert to GIFs), not on a
synthetic rig. The card closes on the automated evidence above.

## 2026-09-16 - Reopened: GIF cards did not play on hover (Fabio), fixed in MPI-757 Batch 3

Root cause (worker, reviewed by the orchestrator): `js/utils/assetKinds.js` matched the GIF filename
fallback against the WRAPPED `/project-file?path=...` URL (plus `&v=<mtime>` after a reload), which
never ends in `.gif`. A card without a `gif` field therefore classified as `image` and never got the
grid's hover bindings. The old spec missed it because it drove hover with synthetic `dispatchEvent`, and
the unit fixtures used bare paths. Fix: `_underlyingPath()` decodes `path=` before the extension test.

Second half of the same data flow (orchestrator, as integrator): the upload response's `gif` field was
dropped client-side, so a freshly imported `.gif` lived with `gif: null` until a reload. Now
`uploadMediaFile()` returns it, the gallery drop emitter forwards it, and `_buildGroup()` passes it to
`createImageItem()`. `docs/events.md` payload updated. The history-block emitter is a PNG snapshot and
the recorder is audio, so neither needs it. The PromptBox emitter and the `js/events.js` comment are
under MPI-774's claim: asked in message 9aec0dd9 (harmless if left, since classification no longer needs it).
`update-meta` merges partial updates, so the live `gif: null` never overwrote a sidecar.

| Check | Command | Result |
|---|---|---|
| Desktop specs (worker, red first) | `tests/desktop/gallery-gif-hover.spec.js` new wrapped-URL test | RED on pre-fix (`Expected "gif", Received "image"`), then green |
| Desktop specs (orchestrator) | gallery-gif-hover + gallery-renditions + gallery-media-release + gif-make + gif-workspace | all pass |
| Kind tests | `node --test tests/asset-kinds.test.cjs tests/gallery-renditions.test.cjs` | 20/20 |
| Full node suite | `node --test "tests/*.test.cjs"` | 1141 pass, 0 fail, 1 skipped |

Unrelated, noticed: `tests/desktop/media-import-outside-gallery.spec.js` fails intermittently in LONG
runs only. A ~15 s stall showed up in 5 of 8 runs of 4+ spec files and in none of 6 shorter runs. A
timing probe showed the whole server stalled (even `/system/stats` polls finished together), while the
import chain itself was fine (`project:group-added`, then the card 20 ms later). The spec's fixed 2 s
sleep loses that race. Both handlers involved are async; cause not found; not this batch.

**SUPERSEDED (below):** Fabio's check after this fix still failed.

## 2026-09-16 - Reopened again: hover mounted the GIF but it stayed invisible (fixed)

Fabio: after an app restart his GIF cards still did not play on hover. His cards already carry the
`gif` field, so the `assetKinds` fix above did not apply to them.

Root cause, reproduced on a copy of his real card (`test` project, group `ebffeb9f`, gif_001-004) in a
private desktop instance with a real cursor hover (scratchpad `repro759/repro759.spec.js`): the hover
DID mount the `.gif` overlay and it DID get `--hover-video-ready`, but its computed opacity stayed `0`.
The overlay is an `<img>` carrying the poster's `mpi-group-card__thumb` class, so the poster's
load gate `.mpi-group-card img.mpi-group-card__thumb:not(.mpi-group-card__thumb--loaded)` (specificity
0,3,1) matched it and beat the overlay's ready rule (0,2,0). A video overlay is a `<video>`, so it never
matched. Every GIF card was invisible on hover since Batch 1; the specs asserted only the `src`.
Fix: the load gate excludes `.mpi-group-card__thumb--hover-video` (`MpiGalleryGrid.css`).

| Check | Command | Result |
|---|---|---|
| Real card, before fix | `npx playwright test --config=<scratchpad>/repro759/pw.config.js` (8 screenshots of the hovered card, 70 ms apart) | overlay opacity `0`, 1 distinct frame |
| Real card, fix patched in-page | same, `REPRO_FIX=1` | opacity `1`, 2 distinct frames |
| Real card, repo fix | same; `REPRO_SEL=0` for gif_001 | 2 distinct frames (gif_004, 2 pages); 3 (gif_001, 3 pages) |
| New outcome assertion, red first | `npx playwright test --config=playwright.desktop.config.js tests/desktop/gallery-gif-hover.spec.js -g "REAL mouse" --output=<scratchpad>` | before fix: `Expected "1", Received "0"`; after: pass |
| GIF + gallery desktop specs | `npx playwright test --config=playwright.desktop.config.js tests/desktop/gallery-gif-hover.spec.js tests/desktop/gif-make.spec.js tests/desktop/gif-workspace.spec.js tests/desktop/gif-cutout.spec.js tests/desktop/gallery-renditions.spec.js --output=<scratchpad>` | 13/13 pass |
| Full node suite | `node --test "tests/*.test.cjs"` | 1189 pass, 1 fail, 1 skipped; the fail is `tests/agent-corpus.test.cjs`, which carries a peer's uncommitted edits and passes alone (`node --test tests/agent-corpus.test.cjs`) |
| Component lint | `npm run lint:components` | clean |

**CLOSED BY FABIO (chat, 2026-09-16 ~13:10Z):** after Ctrl+R, "hovering cards now work" in his app.
The card can move to done at close-out on this evidence.

## Fabio's sign-off, 2026-09-19

Asked directly whether the GIF cards still sitting in `doing` with validation
attention could close, Fabio answered: *"if they're GIF-related, they should be
parked in done. But then the verifications and everything are working fine."*
MPI-771's own last fix (the Mask Brush / Cut-out stroke disagreement and the
playing-tint flip, `dc97b98c`) he verified in his own app earlier the same
evening: *"it's verified. It looks good."*

That is the user verification these cards were held open for. Closed on it.
Agent access to the workspace, which is what the audit that held MPI-771 open
turned up, is its own card: MPI-830.
