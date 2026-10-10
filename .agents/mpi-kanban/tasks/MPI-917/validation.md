# MPI-917 validation

## Phase 1: the recipe and the shared audio maths (2026-10-10, session c8b1e128 "3D Scene 32")

One worker (board batch), reviewed and re-run by the orchestrator. Files: `js/data/mixRecipe.js`,
`js/data/mixMath.js`, `tests/mix-recipe.test.cjs`, `tests/mix-math.test.cjs` (all new).

- **Unit:** `node --test tests/mix-math.test.cjs tests/mix-recipe.test.cjs` **58/58**;
  `npx eslint` on both modules + the math test clean. The `require('../js/data/mixMath.js')` from a
  `.cjs` (the routes/ contract, routes/connector.js:80) is a test.
- **Review caught three defects in the first cut, all fixed + tested:** (1) the STEREO pan was a
  balance control, not the W3C `StereoPannerNode` law (research/tests-parity.md:60-64): hard left
  dropped inR in the render while Web Audio sums it into L, so preview and render disagreed.
  `panGains` now returns the full 2x2 matrix `{ ll, lr, rl, rr }`. (2) a crossfade on the LAST
  video clip (join = to the next clip) was subtracted from the duration and accepted:
  `video-crossfade-on-last` + `video-crossfade-too-long` now reject it. (3) a muted + soloed track
  played: mute now wins (`mute || (hasSolo && !solo)`), the standard DAW rule (orchestrator's pick).
- **Then the orchestrator found a 4th by feeding the strings to the real ffmpeg:** a silent row
  emitted `c1=0`, which ffmpeg refuses at filter init ("Expected in channel name") - every
  hard-left / hard-right render would have failed. Now `0*c0`; a test runs every
  `ffmpegPanExpr` (mono + stereo, p = -1, -0.5, 0, 0.5, 1) through `services/ffmpegBinary`'s ffmpeg.
- **Mutants killed:** mono L/R swap; no fade-in ramp; solo ignored; crossfade not subtracted;
  stereo cross-feed dropped; solo overrides mute; last-clip crossfade subtracted; last-clip check
  removed; bare `'0'` silent row (fails the real-ffmpeg test).
- **Picks where the plan was silent:** `LIMITER_CEILING_DB = -1` (dBFS); `fadeGainAt` returns 1
  outside the clip (callers gate on the clip's span); `resolveSolo` adds `effectiveMute` to a copy
  of each track.
