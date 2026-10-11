# MPI-1082 validation

## Cause (measured, 2026-10-11)

`shellWindow()` returns once the shell has booted (`page-*` on body), but main.js only
reveals the window after `shell:landing-ready`, which waits on the landing's mascot clips.
A probe at the top of the spec read the main window `isVisible() === false` when
`shellWindow` returned. The first `requestAnimationFrame` fired 730 ms later, and the
next frames took 998 ms and 240 ms.

MpiBaseFlow's Next click is synchronous (`_goTo` -> `_renderSlide`). Only
`data-active="true"` on the new slide waits for the next frame. The spec's fixed
300/400 ms sleeps therefore raced the reveal. With the probe's short wait in front, the
spec failed 3/3 locally with the CI signature (`noSlide: true`). CI 38122461080 failed on
all 3 retries on a slower runner.

## Fix

`tests/desktop/flow-slide-scroll-reaches-top.spec.js` changes:
- The Next clicks are checked for their synchronous effect: the ticker reads steps `[0, 1, 2]`.
- `waitForFunction` waits until the active slide holds `.mpi-base-flow__work`.
- The 400 ms wait after `open()` and the 60 ms wait after `scrollTop = 0` are gone. Layout is synchronous.

## Evidence

- 5/5 green locally (`--repeat-each=5`, retries 0).
- Negative control: a scratch copy forcing `align-items: center` fails on the real
  assertion, `topAtScrollZero` -203. The spec still proves MPI-596.
- `npx eslint` on the spec: clean.
- Commit 9a4e218e3. CI run 38128070278 (head f196da565, which carries it) is green on all 5 jobs. The spec passed first try: `ok 41 ... (4.4s)`.
- The master red met on the way: unit `remote-uploads.test.cjs` ECONNRESET on 6720b7446, a commit with binary display assets only. That is a flake. `gh run rerun --failed 38127359040` came back green on all jobs.
