# MPI-1106 validation

2026-10-12, session 2001b3f5 - CPU half:

- `js/shell/gifJobs.js`: `gif.make`, `gif.edit`, `gif.to-video`, `sheet.make` run inside
  `runCpuJob` (MPI-1104), so each is a Transfers row with the sweep while it runs. `gif.cutout`
  wraps only its two CPU steps (`/gif-cutout/source`, `/gif-cutout/apply`); its mask run is GPU.
- `node --test tests/connector-gif-jobs.test.cjs tests/cpu-jobs.test.cjs` - 26 pass. New case:
  the row exists during `/gif/make` and is gone after a success AND after a route failure.
- `npx eslint js/shell/gifJobs.js` - clean.

Open (resolved below by session 697136f6):
- ~~Gallery right-click Make GIF~~ - done.
- ~~GPU half~~ - done, Fabio approved all three callers.

2026-10-12, session 697136f6 - GPU half + gallery Make GIF:

- `runGifCutoutTrack` (commandExecutor.js) is now `runCommand`'s fourth twin: it registers a
  store job on the engine's lane, acks the prompt, settles DONE / ERROR / CANCELLED, and a Stop
  interrupts OUR prompt (targeted, plus queue delete). `isMaskTrackOp` names its two ops (a list
  in the executor, because MPI-1101 held commandRegistry.js; see brief `## Noticed`).
- `startGeneration` picks it for those ops and ends them in a `masks` branch: no card, masks to
  `callbacks.onMasks`, SAM3 preview to `callbacks.onMaskPreview`, a Stop to `onCancel`. The
  child-safety gate skips mask ops like text ops (no picture is made; "clothes" would trip the
  picture check on a temp clip).
- `enqueueMaskTrack` (generationService.js) is the one entry for all three callers: agent
  `gif.cutout` (gifJobs.js), the GIF Cut-out panel, the Video Mask panel. Its handle's `cancel`
  stops the job pending or running. The panels no longer drive `StatusBar.progress` for an
  engine run (By colour still does: renderer code, no engine); their source encodes are
  Transfers rows (`runCpuJob`).
- Gallery right-click Make GIF: the `/gif/make` fetch runs inside `runCpuJob('Making a GIF')`.
- Tests: new `tests/mask-track-queue.test.cjs` (2: queue row + params + masks + preview; Stop
  interrupts our prompt and ends as a cancel), new case in `tests/connector-gif-jobs.test.cjs`
  (agent `gif.cutout` end to end against a stubbed `runWorkflow`: queued while running, 3 masks
  reach apply, entry lands on the same card). Two source-shape tests re-anchored for the new
  executor (`lane-settle-on-bail`, `cloud-executor`).
- `npm test` (all `tests/**/*.test.cjs`): 3257 tests, 3255 pass, 0 fail.
- `npx eslint` on the 6 changed JS files: clean.

Not yet seen: the two panels in a running app (a real SAM3 / BiRefNet run, the queue row, Stop).
That needs the engine, so it is Fabio's eye test.

2026-10-12 evening - Fabio's eye test: "Everything else is cool", one fix. A GIF Remove
background run showed the status bar ORANGE (video) - the op's registry `mediaType` is video
because its input is a temp clip. A GIF is an image op, so pink. The op also serves Video Mask,
where orange is right, so the colour follows the caller: `enqueueMaskTrack({ mediaType })`
(default image, Video Mask passes video) rides `tool:running` into
`getCommandAccent(type, mediaType)`. New case in `tests/mask-track-queue.test.cjs` (GIF ->
vision, clip -> video; read ['video','video'] before the fix); `tests/status-bar-accent.test.cjs`
re-anchored. `npm test`: the only failure was that re-anchored assertion, now green; lint clean.
Left: Fabio's glance that the GIF bar is pink.

Close 2026-10-12: CI tests.yml green on both code commits (a974c2f23, 72bfffa08). Claim audit: 27 PROVEN, 0 FALSE (1 UNPROVEN = the npm test count, a runtime measurement). Closed on evidence.
