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
