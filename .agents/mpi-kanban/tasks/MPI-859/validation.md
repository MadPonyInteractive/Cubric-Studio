# MPI-859 — validation

## What ran

- `tests/gif-frame-masks.test.cjs` — 7 pass, 0 fail. Four new cases cover the proposal
  lifecycle: it shows but is invisible to `maskFor()` / `hasAny()`, it outranks a committed
  mask on display only, a run supersedes the last one and Clear backs one out, and it never
  outlives its frame list while surviving a reorder.
- **`maskCompose.js` on real pixels, in real Chromium** (playwright-cli against a static page
  serving the module over http — canvas blend modes cannot be proven in Node). Eight cases,
  all pass: `add` = max, `subtract` = min(base, NOT candidate), two methods stacking, a soft
  edge surviving the union unrounded, the first Add returning the engine's own PNG untouched,
  a subtract from no mask staying null, a subtract that takes everything staying an all-black
  MASK, and Fabio's own case (tracked subject, then key a leftover colour and Subtract it).
- `npm test` — 1595 pass, 0 fail, 1 skipped.
- `npx playwright test --config=playwright.desktop.config.js tests/desktop/gif-cutout.spec.js
  tests/desktop/gif-workspace.spec.js` — **16 pass, 0 fail**, in the real Electron app.
- `eslint` clean on every changed file; `validate_board.py .` exits 0.

## The two assertions that read the other way before this

Both are in `gif-cutout.spec.js`'s real round trip, which cuts the frames and reads their
alpha back off disk with sharp — so they are pixel evidence, not UI state:

- `f2(C, C)` — a single-frame run that found NOTHING, Added, now leaves frame 2 with the mask
  Track All gave it (255). It used to read 0: the empty result REPLACED the track and the
  frame cut to nothing.
- `k1(SZ - 7, SZ - 7)` — a colour key that matches nothing on frame 1 now leaves its tracked
  circle alone, so outside the circle is still cut (0). It used to read 255: keying green
  threw the SAM3 mask away and kept the whole frame. That is Fabio's complaint, in a test.

## Not covered by a test — one live judgement for Fabio

A proposal is drawn with the SAME tint as a committed mask, and it is the one time the
highlight is not "what disappears" — it is "what this run found". The hint line says so while
the commit row is up, and the method hints name the usual verb (Add for Background / By name,
Subtract for By colour). Whether that reads clearly on a real clip, or whether a proposal
needs its own colour the way the image workspace's green pick does, is Fabio's call.

`routes/` is untouched, so a RELOAD is enough to see this — no app restart needed.

## Known, not fixed here

`docs/masking-sam3-gif.md` is 310 lines against the 200-line cap (283 before this card). The
split is its own job.
