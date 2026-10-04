# MPI-1014 validation

## 2026-10-04 — built and self-verified (session fb35112a)

Root cause: MPI-961 gave the History canvas a server display copy; the Flow image loader and the
six Flow step screens never got it, and every Run-time `compose*` built a source-size canvas. The
server copy also fell back to the ORIGINAL for a file no sidecar owns, which is exactly a Flow's
uploaded photo (`.preview-assets`) — Fabio's broken 32K chip.

- `tests/desktop/flow-big-photo.spec.js` (new): a 2048 photo in `.preview-assets`, display cap
  forced to 256 — Paint, Box, Crop each decode ONLY `*.fit256.webp`, never the PNG, and report
  2048x1024; `composePaintLayer` of a 16384x8192 layer returns 4096x2048. **RED on HEAD** (all
  ten runtime files swapped back: the PNG was decoded), green after.
- `tests/object-stamp-flip.test.cjs` + "Auto on a 16K scene": the stamp is 4096x2048, object at
  its scaled place. RED on HEAD (16K canvas), green after.
- `tests/outpaint-next-pass.test.cjs` + "a 16K frame is composed at most 4096": 4096x3584 frame,
  source drawn at y 512, 4096x2560. HEAD refuses that frame (234 MP > 179 MP).
- `tests/canvas-display-rendition.test.cjs` / `engine-input-cap.test.cjs`: the "no sidecar ->
  serve the original" assertions REVERSED to the new rule (temp-cache WebP, nothing in `.meta`).
- `outpaintRefusal` + its test removed (orphaned: the frame is never built past 4096 now).
- `npm test`: 2701 tests, 2699 pass, 0 fail. Desktop: flow-big-photo, step-paint-pick,
  crop-resize-output, flow-step-gate, flow-result-follows-steps, flow-clear-slot-advances,
  flow-reuse-opens-without-model, the media-picker specs — all green. eslint clean.
- **Real 32768x16384 photo, real Chromium** (throwaway spec, deleted): Draw It In's Inputs chip
  showed a 4096 copy in 1.6 s (first copy made), Paint step ready in 82 ms, Paint/Box/Crop all
  report 32768x16384.
- `/engine-box` mapping a smaller layer onto the photo: already covered by
  `tests/engine-mask.test.cjs` ("layer at HALF the photo's size").

NOT run: a GPU generation through Draw It In / Object Stamp / Outpaint on a 16K (Fabio's GPU or a
Pod: needs his yes). Left: Fabio's look.

## Phase 4 - a new image in a slot resets the steps bound to it (2026-10-04)

`MpiBaseFlow.js` `_setSlot`: the ONE write for every slot path (X, picker pick, upload/drop).
When the url changed it drops the value of each step ON the role or reading it via `sourceRole`,
keeping `fields`; the same picture re-picked keeps the drawing.

- `tests/desktop/flow-swap-resets-steps.spec.js` (new): Object Stamp, a real picker swap of the
  Object slot. **RED on HEAD** (`image2` kept `{removeBg, bgUrl: old-cut, erase: old-mask}`),
  green after: cutout value gone, Place reduced to `{ fields: { positive: 'keep me' } }`, and a
  same-card re-pick kept both.
- `npm test`: 2701 tests, 2699 pass, 0 fail. All 35 `tests/desktop/flow-*.spec.js` green
  (incl. flow-clear-slot-advances: the X button now goes through the same `_setSlot`). eslint clean.
- CI green on `3ed4ae7cd` (Tests + Red master watch) and `d9db2af70`.

Left: Fabio's look on all four image Flows (swap an image after drawing: the step mounts clean).

## Brush size on a big picture (2026-10-04, Fabio's look at Object Stamp on a 16K)

The cutout brush at its 400 px cap drew a ring a few screen px wide. Root cause: the Cutout and
Paint brushes are in IMAGE px with default 40, cap 400 and wheel step 5 tuned on a ~1K picture.
`brushScale(size)` (`brushDab.js`, long edge / 1024, min 1) multiplies all three in both twins;
MIN 2 never scales; Paint's default re-derives on a canvas resize only until the user picks a size.

- `tests/desktop/flow-big-photo.spec.js` + "the cutout and paint brushes grow with the picture":
  a 2048 photo gives default 80, cap 800 on both. **RED on HEAD** (the three files swapped back),
  green after.
- `npm test` 2699/0; 30 desktop specs touching paint, cutout and the Flows green; eslint clean.
- NOT changed: the History canvas brush (no cap there, step 5 px). Fabio 2026-10-04: "it seems
  to go as big as it wants to... perhaps it doesn't need a fix" - a built + RED-proven change was
  reverted unpushed.

## Fabio's look: PASSED (2026-10-04)

Fabio "1" on the four image Flows (image swap resets the steps, cutout + paint brush on 16K).
Closes once CI is green on `1193fd7c0` (contains `c482068db`; `db11c7fa6` already green).

## Closed (2026-10-04)

`gh run list --branch master`: Tests `success` on `1193fd7c0` (and `5d84b7449`, `db11c7fa6`).
With Fabio's "1" above, MPI-1014 moves to done.
