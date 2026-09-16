# MPI-788 validation

## Root cause

`MpiToast`'s `dismiss()` swapped `--open` for `--closing` and removed the toast only on
`transitionend`. That event only fires if a transition actually runs. A click that lands before the
OPEN fade has painted a frame (the transition exists but is still pending, `currentTime` 0) finds
opacity still at 0 and transform still at -18px, which are exactly the closing values. No close
transition starts, `transitionend` never fires, and the toast stays invisible in `--closing`
forever: still counted as visible, so it holds one of the two slots and every queued toast behind
it stays hidden. A product bug (a quick click on a toast that appears while the renderer is busy),
not only a test flake.

Instrumented runs of the MPI-784 spec's steps (hand-rolled Electron launch, `CUBRIC_E2E`, own
profile and port), logging transition events on the clicked toast:

- failing (3 of 4): at the click, animations `opacity:running:0, transform:running:0`, no
  `transitionrun` yet; after the click, no transition events at all; 8 s later still in the
  document, class `--closing`, opacity 0, no animations.
- passing (1 of 4): click at `currentTime` 33 ms, so `transitioncancel` then a new close
  transition, `transitionend` at +133 ms, removed.

Why the spec timing varies: boot keeps the renderer busy after `engine:install-skipped` (the 18+
gate lands in that window), so the open fade often has not started when Playwright clicks.

## Fix

`dismiss()` waits on `el.getAnimations()` filtered to `CSSTransition` (the toast's own
transitions; `getAnimations()` flushes style, so it sees the ones this class change started) with
`Promise.allSettled(... .finished)`. No transitions means the toast is removed on the next
microtask; a cancelled transition settles too. No timeout.

## Evidence

- `tests/desktop/toast-click-dismiss.spec.js` + `toast-serial-countdown.spec.js`,
  `--repeat-each=5`: 10 passed. Before the fix `toast-click-dismiss` failed 3 of 4.
- New deterministic step in `toast-click-dismiss`: mount a toast and click it in the same task.
  Against HEAD's `MpiToast.js`: spec 3 of 3 red (two on the real-click step, one on the new step,
  after its real click happened to pass). File restored and checked byte-identical.
- Real-click probe on the fix, 4 runs: two clicks mid-fade removed after 297 / 196 ms (fade ran),
  two clicks on a pending fade removed after 4 / 5 ms (no fade), none stuck.
- `npm test`: 1219 pass, 0 fail. `npx eslint` on both files: clean.

## Not changed

- `MpiSlideOver` has the same `transitionend` dependency, covered by an existing 400 ms
  `setTimeout` backstop. It works, so it was left alone; the same `getAnimations()` wait would
  replace the backstop if it is ever touched.
- `llm-settings-remote.spec.js`, the other red on master CI, is MPI-789 (a peer session).

## Docs

`docs/toasts.md` § How a toast reaches the screen: leaving waits on the toast's real transitions.
