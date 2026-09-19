# MPI-822 Plan — Flows: Generate becomes Cue

Spec is `brief.md` — every product decision is answered there. This file is the
implementation shape plus what changed once the code was read.

## Current State

Code complete and self-verified; WAITING ON FABIO'S APP CHECK (verify mode is
user-ux). npm test 1444/1444, lint clean, and the new contracts proven RED on
pre-fix code. Evidence: validation.md. Session `d1861e83`, claim `b89bab94`.

Next action: Fabio runs the five steps in validation.md. Nothing else is pending.

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

## The Q bug — OPEN. Four causes eliminated statically; one live check left.

Fabio, 2026-09-19: *"pressing Q once does nothing"*. The wording matters — it implies
a SECOND press works, which is the shape of a stale toggle, not a dead bind.

**Ruled out, with the evidence, so nobody re-derives these:**

| Theory | Killed by |
|---|---|
| Gallery block unmounted under the flow, so nothing bound `queue.toggle` | `MpiFlowLibrary._pick` only emits `flow:open` when `state.currentPage === PAGE_GALLERY`, and the flow mounts as an overlay — the block stays mounted and its `Hotkeys.bind('queue.toggle')` (`MpiGalleryBlock.js:115`) stays live |
| The overlay swallows the keydown | `hotkeyManager.js:69` listens on `window` with `{ capture: true }` — nothing downstream can stop it |
| The slide-over opens BEHIND the flow overlay | The rule exists (`MpiSlideOver.css:106`, `calc(var(--main-overlay-z,90)+10)`) AND the flow overlay publishes the var: it mounts `mountTarget: 'main-area'` (`MpiBaseFlow.js:223`), the exact condition on the publish at `MpiOverlay.js:178` |
| The `isTyping` gate eats the single letter `q` | Possible only with focus in a text field; the Generate slide has none, and `isTextEntryElement` is textarea / contenteditable / text-ish input only |

**The surviving suspect — a stale `_active` in `MpiSlideOver.js`.** The toggle reads:

```js
if (_active && _activePanelId === nextPanelId) { _active.el.close(); return; }
```

`_active` is cleared ONLY by the panel's own `close` event (`:170-173`). Any path
that tears the panel down without emitting `close` — `ui:close-all-popups`, a
workspace switch, the flow overlay's own teardown — leaves `_active` pointing at a
dead instance. Q #1 then calls `close()` on that corpse (invisible — "nothing
happened") and Q #2 opens a fresh one. That matches Fabio's wording exactly.

**Next action — the live check, ~2 minutes.** Not more static reading; this needs the
running app. See MEMORY.md "Verify a real generation in the USER's app", or
"Run renderer-only code in MY isolated instance" for the safe variant:

- Does Q **twice** open it? That alone confirms or kills the stale-toggle theory.
- Instrument: log `_active`, `_activePanelId` and `document.activeElement` at the
  moment Q is pressed. `activeElement` settles the `isTyping` residual in the same
  breath.

If it IS the stale `_active`, the fix belongs in `MpiSlideOver.js` — the teardown
must clear the module-level pointer on EVERY close path, not only the one that
emits. That is a shared-primitive fix: check every caller
(`.claude/rules/root-cause.md`).

## Remaining Work

See `checklist.md`. The only open item is the Q bug above.
