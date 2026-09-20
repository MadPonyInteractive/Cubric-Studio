# MPI-822 Validation

## FIRST APP PASS, 2026-09-19 - FAILED. Read this before the green table below.

Fabio ran it. Two faults, one of them mine and serious:

1. **ReferenceError on the whole run path.** `_setRunning(isRunning)` became
   `_syncRunning()` and ONE use of the old parameter was left behind:
   `Uncaught (in promise) ReferenceError: isRunning is not defined at _syncRunning
   (MpiBaseFlow.js:3220:26) at _run (:3484:13)`. Cue threw and nothing dispatched.
   **FIXED** (`_setScanline(_running)`).

   WHY EVERY CHECK BELOW MISSED IT, because this is the reusable lesson: the new
   tests are source-contract REGEXES - they read the file, they never execute it, so
   a ReferenceError is invisible to them. And `npm run lint` cannot help either:
   **`eslint.config.js` does not enable `no-undef`.** Proven after the fact - with
   the bug re-introduced in a scratch copy, an ad-hoc `no-undef` config reports
   `3224:26 error 'isRunning' is not defined`. Re-run over every file this card
   touched: clean, so this was the only one. Turning the rule on repo-wide is out of
   scope here and has been raised separately.

2. **Stop was `size: sm` beside a `size: md` Cue** and read as misaligned.
   **FIXED** - both `md` now. Deliberately NOT the PromptBox's `sm`: that bar
   stacks Stop and Clear beside its own Cue, this column is one row.

3. **Q does not open the queue slide-over from inside a flow. FIXED 2026-09-20**,
   in `js/components/Primitives/MpiOverlay/MpiOverlay.js`, not in MpiSlideOver.
   `el.show()` publishes `--main-overlay-z` only for a `main-area` overlay (the flow
   frame is the only one); `el.hide()` retracted it unconditionally. So closing ANY
   second overlay over a live flow - `#flow-back` to the Flow Library, the LoRA
   cogwheel, the model picker - wiped the flow's own publication, and the queue
   slide-over's `calc(var(--main-overlay-z, 90) + 10)` fell back to z 100 under the
   flow's 10010. Q worked on the first press all along; the panel just slid in
   BEHIND the flow. Retraction is now gated on the same `main-area` condition as the
   publish. Full write-up and the shared-primitive sweep: plan.md ' The Q bug.

The table below is therefore the state AFTER all three fixes.


**Verify mode:** user-ux — the card is a button, its copy and a layout. Automated
checks can prove the wiring; they cannot tell Fabio it feels right.

## Automated — RUN AND PASSING, 2026-09-19

| Check | Command | Result |
|---|---|---|
| Full unit suite | `npm test` | **1521 pass, 0 fail, 1 skipped** (1522 tests) |
| Repo lint | `npm run lint` (`eslint . --max-warnings=0`) | **clean** |
| MPI-822 contracts | `node --test tests/flow-cue-stacks.test.cjs` | **6/6 pass** |
| **The Q bug, live** | `npx playwright test --config=playwright.desktop.config.js tests/desktop/flow-queue-hotkey.spec.js` | **1 passed** |
| Overlay-adjacent specs | the 4 `flow-*` specs + `gallery-cue-all` | **6/6 passed** |

### The Q-bug spec, and why it asserts a hit test

`tests/desktop/flow-queue-hotkey.spec.js` drives the REAL path - real project on
disk, real gallery block, real `flow:open` through `js/shell.js`, then the real Flow
Library opened and closed over the top. Every other flow spec mounts the frame into
a host div, which is exactly why none of them could ever have caught this: the bug
only exists when a second overlay closes over a live main-area overlay.

It asserts `onTop` via `elementFromPoint`, not `toBeVisible()`. The panel was always
visible by every DOM measure - right size, right position, `aria-expanded="true"`,
transform settled. It was simply underneath. `toBeVisible()` cannot see that.

**Proven RED on pre-fix code.** The spec was written and run BEFORE the fix and
failed on exactly that assertion, reporting
`{"zIndex":"100","mainOverlayZ":"","onTop":false}`; it went green on the fix with
`{"zIndex":"10020","mainOverlayZ":"10010","onTop":true}`. Stated precisely: the red
run used the spec as first written, with fixed 600ms sleeps; the only edit since is
the `settle()` helper that replaced those sleeps, and it touches no assertion. The
fix itself was never reverted to re-run the red.

## The new test was proven RED on pre-fix code

A contract that only passes after the change proves nothing about whether it would
have caught the bug. All 14 of its assertions were run against HEAD's blobs
(`git show HEAD:<path>`) and **14/14 fail there** — the single-slot guard, the
Generate↔Cancel morph, the absent `_runs` set, the `_myTempId` slot, the dispatch
wipe, the blanket `_showResults([])`, the Cue label, the queue-count listener, the
Stop button, its hotkey, and the PromptBox bail.

## NOT proven here, stated rather than skipped

No generation was executed. Nothing below has been observed:

- three presses actually producing three cards,
- Stop ending only the running job while the pending ones survive,
- a pending job being stopped from the queue slide-over's per-row Stop (the panel
  itself opening above the flow overlay IS now proven, by the spec above),
- the Cue/Stop row's layout at the flow frame's 236px control column.

## SECOND APP PASS, 2026-09-20 - PASSED, with one UI fix after it

Fabio ran the five steps below and accepted them, then flagged one thing in the
frame: *"can we make sure that the queue and the stop button are actually exactly
the same height, because this looks like the stop button is broken"*.

**He was right, and it was never a Stop-button bug.** Measured in the running app:
a text `md` MpiButton is **47px** (13px line + 14/14 padding + 2px border) and an
icon-only `md` is **50px**, because `.mpi-btn--md.mpi-ibtn .mpi-icon` is a 20px
glyph. `.mpi-base-flow__run-row` already declared `align-items: stretch`, but the
stretch reached the two mount HOST divs, which are `display: block` - each stretched
to 50px while the button inside kept its own height. So Cue sat 3px short inside a
50px box, which is what read as a dented Stop. Fix: `.mpi-base-flow__run-row > * {
display: flex; }` - the hosts pass the stretch through. Re-measured: both 50px,
sharing top AND bottom edge. Pinned by `tests/desktop/flow-run-row-heights.spec.js`.

Sizing `Stop` `md` (round 1) was still correct; it just could not fix an inequality
that lives between the text and icon variants of the same size.

## APP-WIDE: one height per control size (Fabio asked for it, same pass)

*"fix the MpiButton height gap app-wide too, I am tired of these buttons always
adding the wrong height ... look in this flow where it says KREA2: it has a settings
button, and it's all messed up. It happens too often."*

**Measured first, across every variant and size** - the gap was never md-only:

| size | text | icon | icon+text | token now |
|---|---|---|---|---|
| sm | 31 | 34 | 34 | **34** |
| md | 47 | 50 | 50 | **50** |
| lg | 58 | 62 | 62 | **62** |

A text button is a line box (10/13/15px); an icon button is a glyph box (16/20/24px).
`--control-h-sm|md|lg` (`styles/01_base.css`) is now the single answer, applied as
`min-height` per size in `MpiButton.css`. The token is the TALLER side, so icon
buttons are untouched and text buttons grow 3-4px; nothing shrinks, and the `image`
prop's 32px face still wins because a minimum is a floor, not a clamp.

**The `Krea 2` row was a DIFFERENT gap, and the app-wide fix does not reach it.**
Said plainly because the ask assumed it would: that box is `.mpi-base-flow__model-name`
at **39px** on its own 10px padding scale - deliberately mirroring
`.mpi-dropdown__trigger` so the slot keeps its shape when a second model installs -
while the cog is an `sm` button at 34px. Making MpiButton's sizes agree leaves it 5px
short. Fixed at the row: `.mpi-base-flow__model-pick` is `align-items: stretch` and
the cog's host is a flex container, so the cog takes the field's height. Only the
cog's host - the model name relies on `text-overflow: ellipsis`, which does not
survive its box becoming a flex container, and the spec asserts a long name still
clips.

Pinned by `tests/desktop/control-heights.spec.js`: every variant at every size equals
its token, the cog matches the field's height AND top edge, and the ellipsis still
clips. It fails if a new variant arrives at its own height, or if the tokens and
MpiButton drift apart.

**Blast radius checked, not assumed.** Every text button in the app is 3-4px taller.
`grep` found nothing depending on the old numbers (no hardcoded 31/34/47/50/58/62 in
js/ or styles/ beyond an unrelated 34px glyph box, no spec asserting them), and the
FULL desktop suite was run rather than a subset: **142 passed, 3 failed**.

The three are `gif-cutout`, `gif-timing` and `gif-transform`, and they are NOT this
change. Proven rather than argued: the three `min-height` lines were neutralised in
place and `gif-transform` failed identically without them. Their symptoms are a GIF
history entry never written and a frame PNG missing from disk - neither reachable by
a stylesheet. They also passed in CI at `addb1c43`, the commit immediately before this
work, so the cause sits in the shared tree's UNCOMMITTED peer edits (MPI-736's canvas
pass has MpiCanvas.js / MpiStepCutout.js / MpiStepPaint.js open), not in anything
committed. Worth knowing before someone meets them: they are real, and local-only.

Unit suite, on a quiet box: **1524 pass / 0 fail / 1 skipped**. An earlier run reporting
24 failures was CPU contention - the desktop suite was running at the same time.

**CI settled both questions, green on `ddd813da`: 144 passed, 0 failed.** That runner
is clean - no uncommitted peer edits - and it exercises every button in the app, so
the app-wide height change is proven not to have moved anything that matters. It also
ran `gif-cutout`, `gif-timing` and `gif-transform` GREEN, which is the independent
confirmation that the three local failures came from the shared tree's uncommitted
state and never from anything committed here. That closes MPI-822's user-ux
verification: the card is code-complete, self-verified and user-verified.

Scope note, stated rather than glossed: those five steps are all MPI-822. **MPI-827's
own check - an AGENT-dispatched flow watched from the Gallery, card appearing and its
latents painting - was not among them and has NOT been run.** MPI-827 therefore stays
in `doing` on its source-contract evidence alone.

## What Fabio checks in the app

1. Open any flow, press **Cue** three times. The button reads `Cue`, `Cue x2`,
   `Cue x3` — and the frame never blocks.
2. The previous result **stays on screen** while the new runs go (latest-wins), and
   "Saved to your gallery" stays with it.
3. **Stop** ends the running job only; the queued ones keep going.
4. Press **Q** from inside the flow — the queue slide-over opens above the overlay,
   and its per-row stop kills a pending job.
5. **Ctrl+Alt+Enter** inside a flow stops the flow's job and does NOT also stop a
   gallery job running behind it.
