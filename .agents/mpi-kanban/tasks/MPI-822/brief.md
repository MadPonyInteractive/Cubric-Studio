# MPI-822 — Flows: Generate becomes Queue

Fabio, 2026-09-19: *"At the moment we have a generate button that blocks everything. I'd like
it to be a queue button so that it sends the current generation to the queue. This way the user
doesn't get blocked from running multiple flows with the same flow, adding them to the queue, etc."*

## What is actually blocking — the frame, not the queue

The queue already accepts stacked flow runs. `submitFlowGeneration` (`js/services/flowService.js:82`)
goes through `enqueueGeneration` (`js/services/generationService.js:499`) into `_cueQueue`, the same
lane machinery the Gallery's Cue button uses — a flow run is an ordinary queued job today.

What is single-slot is `MpiBaseFlow`:

| Site | File | What it does |
|---|---|---|
| `_run` guard | `js/components/Blocks/MpiBaseFlow/MpiBaseFlow.js:3378` | `if (_running) return;` — a second press is swallowed |
| Button copy | `MpiBaseFlow.js:3113` `_syncRunUi` | `Generate` → `Cancel` while `_running`; the click handler (`:2213`) routes to `_cancel()` , so the control is not even a Generate any more |
| Per-run id | `MpiBaseFlow.js:475` `_myTempId` | ONE tempId — live-latent frames, `generation:preview-reset` and `_cancel()` all key on it |
| Result slot | `MpiBaseFlow.js:515` `_lastResults` / `_lastDisplay` | one result; `_run` nulls it and `_persistResult()`s the null at dispatch (MPI-587/727) |
| Pending note | `MpiBaseFlow.js:503` `_hasPending` | one boolean behind "Generate again" / "Saved to your gallery" |
| Status + gauge | `_setStatus` / `_setGauge` | one string, one bar, written by whichever run is in flight |

So the work is: **de-singleton the frame's per-run state** and change the button from a
run/cancel toggle into a queue action. No queue, lane or `commandExecutor` change is expected —
and per `docs/generation-lifecycle.md` § "Per-gen identity doctrine", anything that survives a
run must be tagged with the gen id, never keyed on `tool` alone.

## Scope

1. **Button** — `Generate` becomes a queue action that stays live: press N times, N jobs enqueued.
   Drop the `_running` early-return and the Generate↔Cancel morph.
2. **Cancel** — moves to the queue panel, which already renders one row per job with its own
   STOP (`MpiQueuePanel`, `getGenerationQueueSnapshot`). Decide whether the frame keeps any
   cancel affordance at all.
3. **Per-run state** — `_myTempId` becomes a set; the live-latent listeners (`preview:frame`,
   `generation:preview-reset`), the gauge, the status line and the scanline resolve against the
   run they belong to, not "the" run.
4. **Result pane** — N runs land N results. Today `_run` wipes the previous result at dispatch.
5. **Ctrl+Enter** (`generation.run`, bound per-show at `MpiBaseFlow` `_bindKeys`) follows the
   button: it queues.
6. **Two-leg flows** — `chainCallbacks` (`flowService.js`) dispatches leg 2 from leg 1's
   completion. Confirm several stacked two-leg runs interleave correctly rather than assuming it.

## Open decisions (product, Fabio's call)

- **Result pane with a queue behind it.** Latest-wins (current shape, just not wiped at dispatch),
  a strip of the runs this session queued, or nothing — the gallery is where results live and the
  pane becomes a preview of the newest. This is the decision that sizes the card.
- **Does the frame still show progress at all**, or is the status bar + queue panel the whole
  story once more than one job is in flight? The status bar already latches last-active-wins.
- **Changing an input while jobs are queued.** Each press should freeze its own input snapshot at
  dispatch (`enqueueGeneration` already freezes a control snapshot for ordinary gens) — confirm
  the flow's `_collectInputs` / `_persistInputs` path does the same and that `Reuse` restores the
  run that actually happened, not the last thing typed.
- **A cap on stacked runs?** Probably none (`docs/README.md` → the user's GPU is the limit), but
  say so deliberately.

## Verify at implementation, do not assume

- The queue slide-over is documented as riding ABOVE the flow overlay
  (`docs/playbooks/add-flow/04-overlay-and-shell.md` § Overlay z-order —
  `.mpi-slide-over--queue { z-index: calc(var(--main-overlay-z,90)+10) }`), and `queue.toggle` (Q)
  is bound by `MpiGalleryBlock.js:115`, which stays mounted under an open flow. Drive it and
  confirm the panel opens and its STOP works from inside a flow **before** deciding the frame
  needs no cancel of its own.
- Flow gens already emit `tool:*` as `tool: 'groupHistory'`, so the status bar tracks them.

## Out of scope

- Queue/lane/`commandExecutor` changes. If one turns out to be needed, that is a separate card.
- The Gallery/History Cue surfaces — they already queue.
