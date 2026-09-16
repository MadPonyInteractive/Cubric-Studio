# MPI-770 Validation

## 2026-09-16 - MPI-757 Batch 2, verified by the orchestrator

| Check | Command | Result |
|---|---|---|
| Make GIF route tests | `node --test tests/gif-cutout.test.cjs tests/gif-frames.test.cjs tests/gif-make.test.cjs` | 21/21 pass (orchestrator re-run) |
| Bite checks (worker) | frame order sorted; padding `fit:'cover'` | both red, restored green |
| Full node suite | `node --test "tests/*.test.cjs"` | 1108 pass, 0 fail, 1 skipped (orchestrator, after integration) |
| Real app E2E (no stubs) | `npx playwright test --config=playwright.desktop.config.js tests/desktop/gif-make.spec.js --output=<scratchpad>`: real project via `/create-project`, three real PNGs through `/project-media/:id/upload`, ctrl-click in a non-gallery order, right-click, Make GIF | pass (worker, then orchestrator re-run). Frame order follows the clicks (centre pixel per page), delays 100 ms, loop 0, padding black on pages 1-2, one-card selection shows the item disabled, gif workspace opens, card still until hover |
| Bite check (spec) | page-0 colour expectation inverted | red (real pixel 32,210,32), restored green |
| Component lint | `npm run lint:components` | clean |

**Bug found and fixed at integration.** The worker's pixel test showed the built `.gif` replaying the
PREVIOUS frame wherever a frame was transparent (the Make GIF padding). The orchestrator fixed
`services/gifFrames.js` `buildGif` (see `docs/gif.md` § Opaque output). The fix also stops a list
that mixes RGB and RGBA frames from losing a frame. `tests/gif-make.test.cjs` now asserts opaque
black padding on pages 1-2. The new transparent-pixels test in `tests/gif-frames.test.cjs` goes
red against the exact pre-fix code, on both the opaque and the transparent path.

Integration: `routes/gifMake.js` mounted in `server.js`.

## 2026-09-16 - Default timing slowed (Fabio)

After seeing it, Fabio said 10 fps flashes unrelated stills too fast (a seizure risk). Make GIF now
holds each still for 1 s (`DELAY_HUNDREDTHS = 100` in `routes/gifMake.js`); MPI-772's Speed tool can
change it later. Re-verified: `node --test tests/gif-make.test.cjs` 3/3, and
`tests/desktop/gif-make.spec.js` passes with 1000 ms on every frame.
