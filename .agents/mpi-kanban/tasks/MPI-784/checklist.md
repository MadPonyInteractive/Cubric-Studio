# MPI-784 checklist

- [x] Click anywhere on a toast calls its existing `dismiss()` (single exit path, drains queue, releases countdown)
- [x] Pointer cursor on the toast as the affordance
- [x] Desktop spec: click dismisses a long-duration toast and promotes the queued one
- [x] Existing `toast-serial-countdown.spec.js` still passes
- [x] `docs/component-contracts.md` MpiToast entry notes click-to-dismiss
