# MPI-1349 validation

Fabio, 2026-10-29: the prompt box's video duration slider stops at 15 s for every video model.
Longer clips are Infinite Video (MPI-1336).

## What changed

- `generationControls.js` `DURATION_MAX` 30 -> 15. One cap: the PromptBox slider's
  `APP_DURATION_BOUNDS` now reads `DURATION_MIN`/`DURATION_MAX` instead of retyping 1/30, so
  the slider and the agent path cannot drift.
- `durationBoundsFor`: a provider's published range is capped at 15 (Wan 3.0 2-30 -> 2..15);
  ranges already under 15 (Seedance 1.5 Pro 4-12) and Veo's fixed 8 are untouched.
- Agent path: a saved shared duration over 15 is clamped to 15 instead of dropped to the 3 s
  default, so it matches what the slider opens at. An asked duration over 15 is refused
  `INVALID_DURATION` "between 1 and 15".
- `promptReuse.js` legacy derive clamps to `DURATION_MAX` (was `Math.min(30, ...)`). The
  controlState fast path replays the snapshot verbatim; the slider mount and the agent path
  both clamp it on read.
- Wan 3.0 description "up to 30 seconds a clip" -> 15.
- Not touched: `cloudExecutor.js` `Math.min(30, clip + refSeconds)` is Wan's reference+clip
  pricing ceiling, not the slider.

## Evidence

- `npm run lint` exit 0; `npm test` exit 0, 3807 pass / 0 fail of 3809.
- New tests: Wan 3.0 bounds 2..15 (`cloud-duration-bounds`), saved 20 -> 15 on the agent path
  and 16 refused (`agent-duration`).
- Own `app:isolated` instance (scratch profile, empty engine root, scratch documents, port
  64424), real renderer in the browser pane, shared video duration seeded at 20, mounted the
  real duration control: minimax-h3 slider aria-valuemax 15, opens at 15, injects 15;
  wan3-cloud aria-valuemax 15, opens at 15; seedance-15-pro-cloud keeps 12.
- `buildPromptReuseSettings({injectionParams:{Duration:20}})` on H3 -> duration 15.
