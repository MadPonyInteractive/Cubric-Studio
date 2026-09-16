# MPI-788 checklist

`tests/desktop/toast-click-dismiss.spec.js` (MPI-784) fails 3 of 4 locally and on master CI:
the clicked toast is still counted after the 1 s budget.

- [x] Instrument the spec's steps: in failing runs the click lands while the open transition is
      still pending (opacity still 0), so the close asks for no change, no transition runs,
      `transitionend` never fires and the toast stays in `--closing` forever, holding a slot.
- [x] Fix `MpiToast` dismiss so removal never depends on a transition that may not run (no timeout).
- [x] Make the spec cover the race deterministically; red without the fix.
- [x] Spec `--repeat-each` green; `toast-serial-countdown` green.
- [x] Docs where the toast lifecycle is described (`docs/toasts.md`).
- [x] Check `llm-settings-remote` (the other CI red blocking pushes): owned by MPI-789, in progress.
