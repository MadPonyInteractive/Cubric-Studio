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

## The live judgement — ANSWERED, and now covered by a test

The question was: a proposal was drawn with the SAME tint as a committed mask, and it is the
one time the highlight is not "what disappears" — it is "what this run found". Does that read
clearly, or does a proposal need its own colour?

**Fabio, 2026-09-20: green.** A proposal wears `--accent-ok`; a committed mask keeps
`--mask-fill` white. Relayed by a peer session as board message
`2a2cfb4f-1f69-4bd4-80ad-8f2a40be951c`, and the same answer was already written down: the
carve-out at `styles/01_base.css:142` and `MpiGifViewer.css:91` says green means "a proposal
still waiting on Add / Subtract / Apply", and made the GIF tint white only *because* "Mask /
Mask all / Mask selected do not propose anything, they WRITE the frame's mask". `a6c423db`
deleted that premise. Both comments are rewritten to state the live rule.

He heard and overrode the argument against: GIF runs are the common path, so the green is on
screen far more than the image workspace's flash. If it reads noisy on a real clip that is a
follow-up, not a reopening.

### What shipped for it

- `gifFrameMasks.isProposalAt(i)` — `overlayAt()` hands back one URL by design and cannot say
  which kind won, so the draw site asks.
- `mask-tint` carries `proposed`. It is NOT derivable at the draw site: Grow / Invert push the
  COMMITTED mask through the same `setCutoutPreview()` override.
- Both surfaces, because Cut-out drives both: `--proposal` on the CSS tint (playback) and
  `MpiCanvas.setMaskDisplayProposal()` (the canvas, which is what is up while the tool is).
  Without the second, a proposal was green playing and white the moment you paused.
- A proposal is never complemented. `_setPlayingTint` used to flip it: the panel only pushes a
  preview for the frame it is ON, so the other frames of a multi-frame run flipped and
  whitened one beat into playback.
- Not under `bwView` — that view finds specks in black and white on purpose.

### Verified

- `tests/gif-frame-masks.test.cjs` — 7 pass, 0 fail, with `isProposalAt` asserted against a
  committed mask on the neighbouring frame and after `clearCandidates()`.
- `gif-cutout.spec.js` asserts the green in `commitMask()`, the one chokepoint every landing
  run in the file goes through: the canvas reports a proposal while the commit row is up, and
  stops the moment Add / Subtract folds it in.
- **Proven RED on the pre-fix behaviour**: backing out the single line that arms
  `_cutoutProposal` fails the real round-trip spec at `commitMask`. Restored byte-identical.
- 16/16 GIF desktop specs in the real app; `npm test` 1599 pass, 0 fail, 1 skipped; eslint
  clean on all nine changed files.

`routes/` is untouched, so a RELOAD is enough to see this — no app restart needed.

## Fabio's live check, 2026-09-20 - and the model it overturned

He masked a duck with Background, pressed Add, and the highlight jumped to the OTHER side of
the frame; then picked the eye's black with By colour, pressed Add, and nothing visibly
changed. Both were one fault: the store held "what stays" and MPI-771 complemented it on the
way to the screen, so the verbs spoke the opposite language to everything visible. His words:
"if you just grabbed all the masking system from the image workspace and imported it here,
the job would be done. That's what I asked in the first place."

### What changed (the port)

- **The store holds WHAT GETS CUT and is drawn as itself.** Green proposes, Add turns those
  same pixels white, Subtract takes them out - `MaskManager.bakeAutoPicksInto()`'s behaviour,
  per frame. A committed mask looks exactly as it did: the complement of "what stays" is the
  same pixels as "what gets cut".
- **Every method proposes the region its LABEL names.** Background masks the background
  (BiRefNet returns the foreground; `invertResult` flips it as it lands). By name the named
  object, By colour the colour.
- **The whole MPI-771 display translation is deleted**: `displayComplement` /
  `_complementMaskLayer` (nothing else in the app used them), `_maskFlip`, `_flipActive`,
  `setMaskDisplayFlip`, the brush's paint/erase swap, the panel's `flip`, the CSS
  `--complement` class. Net: less code than before.
- **`getCutMasks()` flips once at the boundary** (`utils/maskUtils.js` `invertMaskUrl`), so
  `routes/gifCutout.js`, `applyMaskAlpha`, Grow / Fill Holes / Invert and MPI-858's alpha
  ceiling are untouched and see exactly what they saw before.
- **Invert is a cut-time switch, never a redraw** - "the mask is what survives". The tint no
  longer moves when it is toggled; Cut-out and the Mask Brush show the same store always.

### Two behaviour changes Fabio should know about

1. **By name + Add now marks the named object for REMOVAL** (it used to keep it). Keeping a
   named subject is Invert, or Mask-all then Subtract - the flow he described himself.
2. **Toggling Invert no longer moves the highlight.** It changes what the cut keeps, not what
   the mask looks like.

### Verified

- 16/16 GIF desktop specs in the real app; `npm test` 1599 pass, 0 fail; eslint clean.
- New pixel proof ON DISK for the everyday path, in the real round trip: Background -> Add ->
  Cut out with Invert off leaves the subject at alpha 255 and the background at 0, and the
  Background proposal itself is proven to be the engine mask's other half.
- The round-trip story (name the mascot, KEEP it) now runs with Invert on and every one of
  its alpha assertions stands verbatim - the boundary flip and the route's invert proven to
  cancel exactly.
- The three mask-display specs changed their FIXTURES to the new store space and kept every
  assertion about where the highlight lands. One of them was sampling the stage's letterbox
  corner, which only ever worked because the complement bled tint out there; it samples the
  frame's own box now.
- One `npm test` run in this session showed 18 failures in ffmpeg/store/stems tests - none in
  files this card touches, a different set each run, all green alone and on the re-run. 19
  Electron processes were live on the box at the time.

### Rule file - done with permission

Fabio said yes (2026-09-20): .claude/rules/component-mounts.md no longer lists the removed
display-flip API, records that the store is what gets cut, and lists the proposal API. Every
method named there was checked against MpiGifViewer.js.

## Seen once, not reproduced, not ours

`gif-workspace.spec.js` "gif stage: right-click reverses the frames and clears every mask"
failed once in four full runs (a thumb-tint count after a per-frame mask clear) and passed
alone and in two later full runs. It cannot be this change: that test sets track masks and
never a candidate, so `isProposalAt()` is false throughout and every new branch evaluates to
the arguments the old code passed.

## Known, not fixed here

`docs/masking-sam3-gif.md` is 310 lines against the 200-line cap (283 before this card). The
split is its own job.
