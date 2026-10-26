# MPI-1293 Validation

## Automated (2026-10-25)
- `npm test`: 3680 pass / 1 fail before Storyboard 22's commit; the one failure was the new driver
  contract test on storyboardDispatch.js, expected until 06328dd08. On top of 06328dd08 the six
  touched suites pass 56/56 (flow-drivers-report-jobs, generation-batch-queue, flow-cue-stacks,
  storyboard-runner, multi-angle-runner, multi-angle-gizmo); Storyboard 22 ran the full suite with
  this tree: 3681 pass / 0 fail.
- `tests/generation-batch-queue.test.cjs` "cancelCueJobs": a RUNNING graph job (by tempId) and two
  pending driver jobs (by queue id) all leave the queue, the other window's job stays, and every
  pending one ends as `onCancel({ stopped: true })`.
- `tests/flow-drivers-report-jobs.test.cjs`: every FLOW_DRIVERS entry reports queue ids, checks
  `frame.stopped()` before each enqueue, returns `{ finished }`.
- eslint clean on every touched file.

## Live (Fabio's GPU)
- 2026-10-26 Storyboard: PASSED. Fabio: one Stop press cancelled the whole run.
- Multi-angle (pass-2 latents, Stop between passes) and a stacked graph Flow: not yet checked.

Steps:
Not run by an agent: a Stop from an isolated app interrupts Fabio's own render (ComfyUI /interrupt
has no owner).
1. Storyboard with a cast: press Stop once while the cast draws, once while panels draw. The queue
   empties both times and no panel appears afterwards.
2. Multi-angle with 2+ steps (turn + zoom): pass 2 shows live latents in the pane; Stop once
   during pass 1 and once between passes: no further pass queues; status reads "Cancelled."
3. A graph Flow pressed Generate 3 times: one Stop empties all three.
