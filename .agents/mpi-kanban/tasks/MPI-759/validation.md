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

**OPEN:** Fabio reloads his app and hovers a GIF card (a quick look; the spec reproduces a real hover).
