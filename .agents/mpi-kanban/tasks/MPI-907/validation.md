# MPI-907 Validation

## Stills per mascot (2026-09-25, session b13c4313)

Scope per Fabio: no animated clips on toasts, stills; only pick the right mascot.

Automated, PASSED:
- `tests/desktop/toast-mascot.spec.js` 1/1: info -> studio/idle, success + mascot video -> video/happy,
  warning + audio -> audio/greet, `'error'` -> "Failed" label + studio/idle; all 15 stills
  (5 mascots x idle/happy/greet) fetch OK.
- `tests/notification-stale-count.test.cjs` 4/4, new case: a t2v+i2v batch -> video, t2i+t2v -> studio,
  t2i -> vision.
- eslint clean on MpiToast.js, statusBar.js, notificationService.js and both tests.

Fabio's live check (2026-09-25): VERIFIED in the component gallery (Spawn Toast now cycles every mascot + the error alias) - "looks right, looks good".
