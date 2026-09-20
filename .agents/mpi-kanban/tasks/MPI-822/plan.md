# MPI-822 Plan — Flows: Generate becomes Cue

Spec is `brief.md` — every product decision is answered there. This file is the
implementation shape plus what changed once the code was read.

## Current State

DONE. Fabio verified the five steps in the app, round 2, on 2026-09-20 - including
the #flow-back -> reopen -> Q sequence that was the broken one. npm test 1521 pass /
0 fail / 1 skipped, lint clean, the source contracts proven RED on pre-fix code, and
the Q bug found, fixed and pinned by a desktop spec. Evidence: validation.md.
Session `ba0b2680`, claim `5f2a7c14`.

Next action: none for MPI-822 - the card closes once its own CI run (`f9c31fc3`) is
judged green, per `.agents/mpi-kanban/close-out.md`. MPI-827 is a SEPARATE check that
Fabio has not run: an AGENT-dispatched flow, watched from the Gallery.

## Plan Drift (2026-09-19, read before the diff)

Two corrections found by reading the code, before any edit:

1. **Decision 4 needs NO work — it is already satisfied.** The brief feared that
   with N runs queued, a later edit would rewrite an earlier run's input snapshot.
   It cannot: `_run` collects `inputs` into a **closure-local** const per press and
   hands it straight to `submitFlowGeneration`, which freezes it on that job as
   `flowInputs: snapshot`. `openFlowFromReuse` reads `item.flowInputs` — per card.
   What `_persistInputs` rewrites is `state.s_flowInputs[flow.id]`, which is only
   "what the frame shows when reopened", and latest is correct there. No per-run
   snapshot machinery is built.

2. **Binding `generation.stop` in the frame double-stops — one extra line, in
   `MpiPromptBox.js`.** `Hotkeys.bind` fires EVERY handler for a key
   (`hotkeyManager.js:213` — "all are called in bind order"). `_triggerRun` already
   bails when a flow is live (`if (qs('.mpi-base-flow')) return;`,
   `MpiPromptBox.js:2548`); `_triggerStop` one function below does not. Without the
   same bail, Ctrl+Alt+Enter inside a flow stops the flow's job AND the PromptBox's.
   In scope: caused by this card, same shape as its own precedent.

Also settled while reading, needing no new machinery:

- **Two-leg flows need no change.** The run token lives until the CALLER's
  completion, which `chainCallbacks` fires on leg 2. Leg 2 reusing leg 1's tempId
  keeps matching the same token.
- `MpiButton` has `setLabel`/`setDisabled` (`MpiButton.js:162,183`). `_syncRunUi`'s
  hand-written span poke ("MpiButton has no setText") is stale — use the API.

## Shape

- `_running` boolean → `_runs`, a `Set` of per-run tokens `{ tempId }`. The token is
  added BEFORE `_autoEnhance` so the frame reads busy while a 4B thinks, and stamped
  with the real tempId after submit returns. `_running` survives as a derived
  `_runs.size > 0` so the existing read sites (scanline, `_showResults`, the dock
  guard at :2389) do not move.
- `preview:frame`, `generation:preview-reset` and `_cancel` resolve against the set.
- Button: `Cue` / `Cue xN` off `state.generationQueueCount` via `Events.onState`,
  always calling `_run`. No `loopArmed` branch — a flow does not loop. The
  `Generate again` pending variant goes; the "Saved to your gallery" note carries
  that signal.
- A separate Stop button beside it — icon `stop`, `size: 'md'` (see the app-pass
  note below; it shipped `sm` and read as misaligned), `variant: 'secondary'`,
  disabled when nothing is in flight — plus the `generation.stop` hotkey, both
  calling `_cancel`. The Generate↔Cancel morph and `.mpi-base-flow__run--cancel`
  go with it.
- Latest-wins: drop the result wipe at dispatch, and `_hasPending = false` with it —
  the note describes the result on screen, which now stays up.
- Status line: a failure always wins it; complete/cancel defer to `Generating…`
  while runs remain.

## Verification

**Verify mode:** user-ux

`npm run lint`, then in the app: three presses on one flow reads `Cue x3`, the
previous result stays up, Stop kills the running job only, the queue slide-over
(Q) opens over the flow and stops a pending one.

## The Q bug - FIXED 2026-09-20. It was never MpiSlideOver.

**Fabio, first app pass:** *"pressing Q once does nothing"*. It was not a dead bind,
not a stale toggle, and not MpiSlideOver at all. Q always opened the panel, on the
first press, every time. It opened it BEHIND the flow overlay.

**Root cause - `MpiOverlay.hide()` retracted a var it never published.** `el.show()`
publishes `--main-overlay-z` only for `mountTarget: 'main-area'` (:176-180), and
MpiBaseFlow is the only main-area overlay in the app. `el.hide()` dropped that same
var **unconditionally** (:194, comment: *"Safe to call unconditionally"* - it was
not). So ANY second overlay closing while a flow was still up - `#flow-back` to the
Flow Library, the flow's own LoRA cogwheel (`MpiModelSettings`), the model picker -
wiped the live flow's publication. `.mpi-slide-over--queue`'s
`z-index: calc(var(--main-overlay-z, 90) + 10)` then fell back to 100, under the
flow overlay's 10010, and the panel slid in invisible. Fix: gate the retraction on
`mountTarget === 'main-area'`, symmetric with the publish.

**Shared-primitive sweep** (`.claude/rules/root-cause.md`). All 8 `MpiOverlay.mount`
call sites checked: MpiBaseFlow is `main-area` (publishes AND retracts); MpiModelPicker,
MpiModelSettings, MpiCompareOverlay, MpiFlowLibrary, MpiModelManager and the component
gallery are all `body` (now neither). `MpiModal.js:88-94` READS the var to floor above
it and is unaffected. Nothing else in the repo touches `--main-overlay-z`.

**The four statically-eliminated theories were all correct** - and so was the
instruction to go and look instead of reading more code. The one surviving suspect,
a stale `_active` in `MpiSlideOver.js`, was **wrong**: `_doClose` is the only close
path and it always emits `close`, so the pointer cannot go stale, and the live run
confirmed it (Q#2 closes the panel normally). MpiSlideOver was not touched.

**Evidence:** `tests/desktop/flow-queue-hotkey.spec.js` - real project, real gallery,
real `flow:open`, real Flow Library over the top. It asserts the panel is `present`,
`aria-expanded`, and `onTop` via `elementFromPoint` - a z-order bug is invisible to
`toBeVisible()`, which is why the hit test is the assertion. Red on pre-fix code with
`{"zIndex":"100","mainOverlayZ":"","onTop":false}`, green after with
`{"zIndex":"10020","mainOverlayZ":"10010","onTop":true}`.

## Remaining Work

See `checklist.md`. Code is complete; the only open item is Fabio's round-2 app pass.
