# MPI-822 Checklist

- [x] `_runs` set of per-run tokens replaces the `_running` boolean; `_running`
      stays as a derived `_runs.size > 0` so the existing read sites do not move
- [x] `_run` drops the `_running` early-return; keeps the empty-media and
      `promptRequired` guards
- [x] Token added before `_autoEnhance`, stamped with the real tempId after submit
- [x] `preview:frame`, `generation:preview-reset` and `_cancel` resolve against the set
- [x] Run button is `Cue` / `Cue xN` off `state.generationQueueCount`, always queues;
      the Generate↔Cancel morph and `.mpi-base-flow__run--cancel` are gone
- [x] Separate Stop button (icon `stop`, `sm`, `secondary`, disabled when idle)
      beside Cue, destroyed in `_teardownSlide`
- [x] `generation.stop` bound per-show in `_bindKeys`, unbound in `_unbindKeys`
- [x] `_triggerStop` in `MpiPromptBox.js` gets the same open-flow bail `_triggerRun`
      already has (see plan.md § Plan Drift 2)
- [x] Latest-wins: the result wipe at dispatch and `_hasPending = false` are gone
- [x] Status line: a failure wins it; complete/cancel defer to `Generating…` while
      runs remain
- [x] `npm run lint` passes on the touched files
- [x] Source contracts written (`tests/flow-cue-stacks.test.cjs`) and PROVEN red on
      pre-fix code — 14/14 assertions fail against HEAD's blobs
- [x] Fabio app pass 1 (2026-09-19): found a ReferenceError I shipped
      (`isRunning` left behind by the `_setRunning` -> `_syncRunning` rename) and a
      Stop button sized `sm` beside an `md` Cue. BOTH FIXED. Proven that
      `no-undef` catches the first and that the repo does not enable it - raised
      separately, out of scope here.
- [x] **Q does not open the queue slide-over from inside a flow** - FIXED. Not
      MpiSlideOver: `MpiOverlay.hide()` retracted `--main-overlay-z` unconditionally
      while only a `main-area` overlay publishes it, so any second overlay closing
      over a live flow dropped the panel to z 100 under the flow's 10010 and it slid
      in invisible. Retraction now gated to match the publish; all 8 MpiOverlay call
      sites swept. Pinned by `tests/desktop/flow-queue-hotkey.spec.js` (plan.md
      " The Q bug)
- [x] Fabio app check, round 2 (2026-09-20): `Cue x3`, result stays, Stop kills only
      the running job, and the queue slide-over opens from inside the flow - including
      after `#flow-back` and a reopen, which is the sequence that was broken. VERIFIED.
- [x] Cue and Stop are EXACTLY the same height (Fabio, round 2: "this looks like the
      stop button is broken, someone hit it"). Measured, not eyeballed: a text `md`
      button is 47px and an icon-only `md` is 50px, and the row's `align-items:
      stretch` only reached the two block mount hosts. Hosts are `display: flex` now,
      so the stretch reaches the buttons. Pinned by
      `tests/desktop/flow-run-row-heights.spec.js` (height AND both edges).
- [x] **App-wide: one height per control size.** Fabio, same pass: "fix the MpiButton
      height gap app-wide too, I am tired of these buttons always adding the wrong
      height" - pointing at the `Krea 2` row's cogwheel. New `--control-h-sm|md|lg`
      tokens (34/50/62px) in `styles/01_base.css`, applied as `min-height` per size
      in `MpiButton.css`. Measured before: text 31/47/58 vs icon 34/50/62. After:
      every variant equals its token. Nothing shrank - the token is the taller side.
- [x] The `Krea 2` row is a SECOND, different gap and needed its own fix: that box is
      39px on its own padding scale, and the cog is an `sm` button at 34px, so
      equalising MpiButton alone would have left it 5px out. `.mpi-base-flow__model-pick`
      stretches and the cog's host is a flex container; the model name's
      `text-overflow: ellipsis` is deliberately NOT swept into that (a flex box loses
      it) and the spec asserts a long name still clips.

Dropped from the original list, with the reason: **no per-run input snapshot was
built.** The brief asked for one; the code already had it (plan.md § Plan Drift 1).
