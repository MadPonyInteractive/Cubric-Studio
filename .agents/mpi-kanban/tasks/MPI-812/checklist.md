# MPI-812 — checklist

Picked up alongside [[MPI-810]] on 2026-09-18: both fixes land in the desktop harness,
and run separately they would have collided in `tests/desktop/launch.js`.

## Root cause

`playwright.desktop.config.js` carried no `preserveOutput`. Playwright's default is
**`'always'`**, so every test's output dir — `user-data` profile included — survived the
run forever. Nothing in the specs was wrong; the reaper was simply never switched on.

That also explains the shape of the measurement in the brief: passing runs leak just as
badly as failing ones, which a "teardown only misses the crash path" theory would not
predict.

## Fix

- [x] `playwright.desktop.config.js` — `preserveOutput: 'failures-only'`.

One line, and it covers **all 57 desktop specs** with no per-spec churn: the 46 that use
`launchApp` and the 17 that inline their own launch all build their profile with
`testInfo.outputPath('user-data')`, so every byte is inside the Playwright output dir it
now reaps. A failing test keeps everything it needs — trace, screenshot, video, profile.

Rejected: threading `testInfo` through `closeApp(app)` to delete the dir by hand. That
changes a signature used by 46 specs to do what the runner already does, and it still
would not cover the 17 inline ones.

## Deliberate residual

A **failed** test still keeps its profile. That is one directory per failure, not 608,891
files, and it is the case where you want to look at what the app actually wrote. The
upgrade path is in the config comment if failures ever start costing real space.

## Out of scope

The 7.5 GB of `pw-*`/`run-*`/`toast-*` leftovers, per the brief. Not touched.

## Verification

- [ ] Run one desktop spec with `--output` into a scratch dir. Passing test: its output
      dir is gone afterwards, `user-data` with it.
- [ ] Force that same spec to fail. Its output dir survives and still carries the trace.
- [ ] Windows caveat to watch for: removal needs the Electron process to have released
      its handles. If a spec leaves the app running, the reap can hit EBUSY — that shows
      as a Playwright warning, not a test failure, so check the run output rather than
      just the exit code.
