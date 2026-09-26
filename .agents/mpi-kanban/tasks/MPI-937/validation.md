# MPI-937 Validation

## Seen live (2026-09-26)

Fabio Stopped a nano-banana-2-cloud t2i as it started. The provider then failed on its own
(app.log 09:05:40Z: `answered HTTP 500 (provider aiplatform.googleapis.com said 400)`), and
the app showed "Cloud generation failed" for a run he had already Stopped.

## Root cause

MPI-928 made a Stop after the send leave the request running (the result is billed, so it
lands). Only `controller.signal` was checked on the way out, and after the send a Stop no
longer touches it, so a failure after a Stop fell through to `_settleError` and its dialog.
The store's own signal is the record of that Stop; `_settleFailure` reads it and ends the run
the way a Stop ends. Nothing was billed (failed calls are not) and nothing is coming.

The gallery half: a Stop with `resultComing` keeps the card cooking with no walk-off. On the
failure it was removed abruptly; it now gets the cancelled clip its Stop put off.

## Evidence

- `node --test tests/cloud-executor.test.cjs`: 27/27. New case fails with the Stop check
  disabled (`actual: 'PROVIDER_ERROR'`), passes with it.
- `npm test`: 1951 pass, 0 fail.
- `tests/desktop/cancelled-mascot.spec.js` (isolated port): passes; case 5b fails at the
  cancelled-clip assertion with the gallery flip disabled.
- eslint clean on both source files.

## Not covered

The provider's own 400 is a separate question: the body is not logged by design, so its
cause is unknown. If a nano-banana-2 t2i fails again WITHOUT a Stop, that is a new card.
