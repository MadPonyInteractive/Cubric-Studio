# MPI-544 - install-toast spam

Carried out of the MPI-542 umbrella so 1.4.1 can ship without it.

## What was seen

During the 2026-08-11 download-mode Pod incident, a burst of install/completion
toasts appeared for installs that were not running.

## What it is NOT

- NOT the MPI-539 reconcile path. The client's `download:complete` handler drops
  events with no `modelId` by design (MPI-97), and that path broadcasts
  `modelId: null`.
- NOT the remote-abandon path. Since a75c8a3e that goes terminal exactly once per
  model job, through `_checkModelJobsComplete()`.

## First candidate

A MODEL-LEVEL `download:complete` re-broadcast when the install SSE reconnects and
replays. The snapshot protocol (MPI-276 G9) versions deltas so a stale one is
dropped - but a replayed TERMINAL event is not a delta.

## What to capture before writing any code

1. The `[download]` lines in `logs/app.log` around the burst.
2. Whether the SSE reconnected in that window.
3. Whether the toasts name a model, or are the generic one.

Unreproduced is not the same as ignored: with no evidence, any fix here is a guess
at a mechanism nobody has observed.

## Noticed - 2026-10-01 (Agent 85, MPI-513)

Still OUT of 2.0 (Fabio 2026-09-29), still unreproduced. One mechanism is now closed: a burst of
"installed" toasts for work that did not happen is exactly what a re-verify of a full volume did
(MPI-497 - bot-driven installs over present deps). Since `9c593af5f` such a job completes with
`alreadyInstalled: true` and is silent. If a burst is seen again, capture as above and check
whether the events carried `alreadyInstalled`.
