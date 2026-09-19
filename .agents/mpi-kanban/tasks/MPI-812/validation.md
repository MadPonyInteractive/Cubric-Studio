# MPI-812 — validation

Closed 2026-09-18. Picked up alongside [[MPI-810]] because both fixes land in the desktop
harness; run separately they would have collided in `tests/desktop/launch.js`.

## What shipped

`playwright.desktop.config.js` — `preserveOutput: 'failures-only'`.

The config carried no `preserveOutput` at all, so Playwright's default of **`'always'`**
applied and every test's output directory survived the run forever, Electron `user-data`
profile included. Nothing in the specs was wrong; the reaper was simply never switched on.

That also explains the shape of the measurement in the brief — 142.1 GB across 228
scratchpads, 608,891 files — which a "teardown misses the crash path" theory would not
predict, because passing runs leaked exactly as badly.

One line covers **all 57 desktop specs**: the 46 that use `launchApp` and the 17 that
inline their own launch all build the profile with `testInfo.outputPath('user-data')`, so
every byte already sat inside the directory Playwright now reaps.

Rejected: threading `testInfo` through `closeApp(app)` to delete the dir by hand. It
changes a signature used by 46 specs to do what the runner already does, and it still
would not have covered the 17 inline ones.

## Evidence

Same run as MPI-810 — `tests/desktop/gif-make.spec.js`, passing, `--output` into a scratch
dir. Afterwards that output dir contained exactly one entry:

```
.last-run.json
```

`find <out> -name user-data` returned nothing. Before this change the same run left a full
Electron profile behind.

## Accepted residual

A **failing** test still keeps its profile, along with its trace, screenshot and video.
Fabio confirmed this is wanted: that is the case where you actually want to see what the
app wrote. It is one directory per failure against 608,891 files before, and the upgrade
path is noted in the config comment if failures ever start costing real space.

## Honest limits

- The failure path was not exercised. A passing test's reap is verified by the run above;
  "a failing test keeps its output" is Playwright's documented behaviour for this setting,
  not something measured here.
- Windows caveat, unverified because nothing hit it: the reap needs Electron to have
  released its handles. A spec that leaves the app running could hit `EBUSY`, which
  Playwright reports as a warning rather than a test failure — so a future "it still
  leaks" report should check run output, not just the exit code.
- Out of scope per the brief and untouched: the 7.5 GB of `pw-*`/`run-*`/`toast-*`
  leftovers.
