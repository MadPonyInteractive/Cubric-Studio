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

## Decisions — ANSWERED by Fabio, 2026-09-19

> *"Yeah, latest wins. The cancel and stop should work just like a prompt box queue. You can
> stop it in the queue, and you can stop it in the prompt box by pressing stop. No cap. Yeah,
> reuse must restore the run that run."*

1. **Result pane = LATEST WINS.** Keep the single result slot; drop only the wipe-at-dispatch
   in `_run` (`_lastResults = null` + `_persistResult()`), so the previous result stays on
   screen until a newer run replaces it. No strip, no per-run history in the pane — the gallery
   is where the runs live.
2. **Stop = the PromptBox shape, copied.** `MpiPromptBox.js` is the reference:
   - a **separate Stop button** beside Run (`stopBtn`, icon `stop`, `size: 'sm'`,
     `variant: 'secondary'`, `MpiPromptBox.js:2415`), disabled while nothing is generating,
     and the `generation.stop` hotkey (Ctrl+Alt+Enter, `:2583`) bound to the same `_emitCancel`.
   - per-job stop stays in the **queue slide-over** (`MpiQueuePanel`), which already renders a
     row per queued/running job.
   So the flow frame keeps its own Stop for the running job; it does NOT keep the
   Generate↔Cancel morph.
   The Run button's label already counts the queue in the PromptBox
   (`_runLabel`, `:2268` → `Cue` / `Cue xN` off `state.generationQueueCount`). Mirror that
   helper rather than writing a second one; confirm the word with Fabio (`Queue xN` is what he
   said, `Cue xN` is what the rest of the app says).
3. **No cap** on stacked runs.
4. **Reuse restores the run that ran.** Each press freezes its own input snapshot at dispatch.
   Today `_persistInputs(inputs)` writes the LIVE frame state, and `_run` re-persists after the
   auto-enhancer rewrites fields — with N runs queued, a later edit would rewrite the snapshot
   of an earlier one. The per-run snapshot has to travel with the job (as `enqueueGeneration`
   already freezes a control snapshot for ordinary gens — `_snapshotControlState`,
   `generationService.js:416`), not live in one frame-level slot.

## Remaining scope

- `_run`: drop the `_running` early-return; keep the empty-media / `promptRequired` guards.
- `_myTempId` becomes a set; `preview:frame`, `generation:preview-reset`, the gauge, the status
  line and the scanline resolve against the run they belong to.
- `generation.run` (Ctrl+Enter, bound per-show in `_bindKeys`) queues, same as the button.
- **Two-leg flows** — `chainCallbacks` (`flowService.js`) dispatches leg 2 from leg 1's
  completion and REUSES leg 1's tempId (`flowService.js:186-190`, written for the
  one-`_myTempId` frame). With a set of ids, re-check that assumption rather than inheriting it.

## Verify at implementation, do not assume

- The queue slide-over is documented as riding ABOVE the flow overlay
  (`docs/playbooks/add-flow/04-overlay-and-shell.md` § Overlay z-order —
  `.mpi-slide-over--queue { z-index: calc(var(--main-overlay-z,90)+10) }`), and `queue.toggle` (Q)
  is bound by `MpiGalleryBlock.js:115`, which stays mounted under an open flow. Drive it and
  confirm the panel opens and its STOP works from inside a flow.
- Flow gens already emit `tool:*` as `tool: 'groupHistory'`, so the status bar tracks them.

## Out of scope

- Queue/lane/`commandExecutor` changes. If one turns out to be needed, that is a separate card.
- The Gallery/History Cue surfaces — they already queue.
- **Latents for a flow run in the GALLERY — MPI-827.** Same conversation, different surface
  (`flowService.js` passes no `placeholderGroup` by design). The two cards touch
  `js/services/flowService.js` between them, so they are NOT parallel-safe with each other.
