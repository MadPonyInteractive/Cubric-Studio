# MPI-784 validation

**Change:** `MpiToast` setup binds `on(el, 'click', dismiss)` — the toast's existing single exit
path, so a click releases the countdown turn (MPI-542) and drains the queue exactly like a timeout.
`cursor: pointer` on `.mpi-toast` as the affordance. Before this, a toast had no click handler at
all (the original close button was removed long ago), so a click did nothing.

**Evidence (2026-09-16, isolated desktop suite, port 60928, user's :3000 untouched):**

- `tests/desktop/toast-click-dismiss.spec.js` — real Playwright mouse clicks on three toasts
  (60s, persistent, 60s-queued): each is gone within 1s of its click, the queued one is promoted
  into the freed slot, `close` fires in order. **1 passed.**
- Same spec with the `on(...)` line commented out: **1 failed** on
  `REGRESSION: clicking a toast did not dismiss it` — the spec catches the defect.
- `tests/desktop/toast-serial-countdown.spec.js` — **passed** alongside, serial countdown intact.
- `npx eslint js/components/Primitives/MpiToast/MpiToast.js` — clean.

Not checked: a click on the content's own scrollbar (only reachable on a message over 40vh) also
dismisses in Chromium only if the browser dispatches `click` for scrollbar presses.
