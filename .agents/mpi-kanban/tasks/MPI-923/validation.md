# MPI-923 validation

## Automated (2026-09-30, Agent 77, session 74f93ae5)

- `node --test tests/deepinfra-wan-media.test.cjs`: 7/7. i2v first/last frame by role and by
  order; ref2v typed references in strip order; t2v sends none; wan3-cloud sees 9/3/3 wells +
  i2v end frame, every other i2v model sees start frame only; renderer `media` carries type +
  role as disk paths; a reference video quotes a ceiling ("up to", 15 s a video, 30 s in all);
  video/audio data URLs, wrong type or size refused before sending.
- `npm test`: 2577 pass / 0 fail (run 2, after the guard-test updates). Run 3 (after the price
  fix): 6 fail, all Character Sheet Flow tests (`flow-chain`, `flow-model-choice`,
  `inject-params-titles` x2, `routine-runner`, `user-flows`), from live peer 123a6c39's
  uncommitted MPI-997 edits to `flow_character_sheet*.json`, `flowsRegistry.js`,
  `flowService.js`, `universal_workflows.js` (its claim). No file of this card involved.
- Guard tests updated on purpose: `ref-tag-picker` (a second tagged op, badge + picker are
  generic on `slot.tag`), `model-priority` (paid `wan3-cloud:ref2v` ranked below local, PAID note;
  `CLOUD_TASKS` + `ref2v`). `ref2v` has no `modelSizedInputs`, so `engine-input-cap` is unchanged.
- eslint clean on every changed file. `release-health-check`: no registry failures (its only
  failures are the missing 1.6.x archival notes, pre-existing).

## Live (paid, Fabio's yes 2026-09-30: 2 runs, 480p 5 s, $0.25 each)

Run through MY isolated instance's `/deepinfra/generate` (port 61912, key from env): the
isolated renderer has no SAVED key, so `/connector/generate` refused `OP_UNAVAILABLE` (unbilled)
and the body `cloudExecutor` sends was POSTed to the route directly.

- **ref2v, image + video + audio reference: PASSED, billed $0.595** (quote was $0.25). Output
  5.04 s, 854x480, with an audio track; the Vision mascot from `<Image 1>` is in every frame.
  Billed = (6.9 s reference video + 5 s clip) x $0.05/s: Wan bills reference-video seconds, which
  its page does not say. Audio (3 s) and image were not billed. Fixed: the quote is now a ceiling
  with a reference video staged (test above).
- **i2v with start + end frame: PASSED, billed $0.25** (Fabio's second yes, 1 run). Output
  5.06 s, 854x480, audio track. First frame = `Vision-Idle.png`, last frame = `Vision-Happy.png`
  (cropped to the 16:9 asked for), so `first_frame` and `last_frame` both landed.

Spent: $0.845 in all ($0.595 + $0.25): $0.50 approved first, then $0.25 more on a fresh yes.
Not seen live: the prompt-box path to a gallery card (the isolated renderer has no saved key);
covered by the `cloudRunFields` unit test.
