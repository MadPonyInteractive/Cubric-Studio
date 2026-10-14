# MPI-1105 validation

Reopened 2026-10-12 (Fabio). The earlier "dropped, closed without code" note was a misreading of
his instruction; he restated the flash.

## Built (session 2001b3f5)

- `js/components/Compounds/MpiQueueFlash/` - a 100 px strip on the right edge, the Cue panel's
  top and bottom, gradient in `--vision-accent` / `--video-accent` / `--accent-audio` by
  `data-subject`, 3 x 1 s pulses, "Open queue" button, hides itself at 3 s. Reduced motion: a
  still strip. Nothing while the Cue panel is open.
- `queue:added { mediaType }` emitted by `runCpuJob` (non-GPU) and `generationService._pushCue`
  (every Cue generation except a loop re-fire). Documented in `js/events.js`.
- Mounted once in `js/shell.js`; Open queue emits `open`, the shell opens the Cue slide-over with
  the gallery's payload, so it opens from the projects page too.

## Evidence

- `npx playwright test --config=playwright.desktop.config.js tests/desktop/queue-flash.spec.js
  tests/desktop/cpu-job-row.spec.js` - 2 pass. Flash appears on a CPU job (video), 100 px wide,
  flush right; Open queue opens Cue showing the job's Transfers row; no flash while Cue is open;
  audio flash goes by itself inside 4.5 s.
- `node --test` over the 46 test files touching generationService / cpuJobs / gifJobs /
  MpiQueuePanel - 487 pass.
- eslint clean on every touched JS file.
- Screenshots at peak: `research/flash-video.png`, `research/flash-audio.png`.

## Revision 1 (Fabio)

- The whole strip is the button (a full-size ghost MpiButton over the pulsing gradient layer),
  with a small `layers` icon + "Queue" label in a chip so it reads over page text. Hover holds the
  strip lit. Spec asserts the button is the strip's full width and height - pass.
- Cue on the projects page: already works (the slide-over is shell-level); the spec opens it there.

## Revision 2 (Fabio)

- No chip: icon + "Queue" label sit straight on the strip (soft text shadow only); the whole strip
  is the click target. Q toggles Cue on the projects page (shell binds `queue.toggle`, gated to
  `PAGE_LANDING`; workspace Blocks keep their own `bindQueueSlideOver`). Spec: Q opens once, Q
  closes once - pass. `QUEUE_PANEL` reused from MPI-623's `js/shell/queueSlideOver.js` (still
  uncommitted there: commit after theirs).

## Revision 3 (Fabio eye test, 2026-10-12)

- Fabio tested it live: "Yes, that's it". Only change asked: three flashes too flashy, so ONE
  flash that fades out over 3 s. The whole element (strip + label) animates 0 -> 1 in ~0.2 s, then
  fades to 0 by 3 s; hover holds it lit. Both desktop specs pass.

## Open

- Closed 2026-10-14 (session 3d712bc0): registration lines added (`preloadStyles.js` CSS entry,
  `types.js` MpiQueueFlashProps); `node --test` flow-result-dock + mask-tool-registry 50/0, eslint clean.
- Fabio's eye test: PASSED 2026-10-14 ("The queue flash passes").
