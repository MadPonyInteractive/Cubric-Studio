# MPI-1075 validation

## The signal (measured 2026-10-11, read-only, no Pod created)

- RunPod v2 has `GET /v2/pods/{id}/logs` (SSE; `source=system|container`, `tail` 0-5000).
  `source=system` is the console's System Logs: host lifecycle and the image pull.
- Healthy boot, Pod xi6ehngx6nge03 (EU-RO-1, startedAt 07:31:47.946Z):
  `create container` 07:31:49 (+1 s), `Pulling from` 07:31:51 (+3 s), `create container:
  still fetching image` every ~16 s, `start container ... begin` 07:33:29 (+101 s).
- Cached image: the same host logged `create container` -> `Pulling from` -> `Status:
  Image is up to date` within 1 s, so a cached boot still writes lines; it is not mistaken
  for a dead one.
- Dead Pods (maduch90z92qjf, xbiazswls7f5x7 and ~7 more): Fabio saw an empty System log;
  their logs route now answers 404 (deleted), so the dead case cannot be replayed.
- The REST Pod fields we log (MPI-1057) read the same on dead and healthy boots
  (status=RUNNING, cudaVersion set, machineAssigned=true at +1 s): no signal there.
- `since=` silently drops EVERY system line (0 returned where lines exist); `tail` +
  a client-side `ts >= startedAt` filter is used instead.
- Backfill latency: headers and all 100 lines in 0.47-0.67 s over 5 runs; the read is cut at 5 s.

## The fix

At 60 s into any boot (`PULL_CHECK_MS`, armed by `_setStarting` beside the 8-min cap), a
200 answer with no system line newer than the Pod's `startedAt` deletes it the stall-cap
way (`stalled` on /remote/comfy/status, same dialog). Any unknown (no answer, non-200, no
startedAt) leaves it to the 8-min cap. Dialog + Settings copy no longer say "after 8 minutes".

## Evidence

- `node --test tests/pod-stall-cap.test.cjs`: 9/9 pass, incl. dead at 60 s and not
  1 ms earlier, healthy left to boot, resumed Pod with only last-run lines deleted,
  throw/500 fail open, real `podSystemLogs` parses a cut SSE stream and never sends `since`.
- All pod/remote/runpod tests: 142/142 pass. eslint clean on the changed files.
- Live, shipped `client.podSystemLogs` on xi6ehngx6nge03: http 200, 100 lines, 100 newer
  than startedAt, 0 when filtered as a just-started Pod.

- CI on 3421921ca (run 38122461080): attempt 1 red on `flow-slide-scroll-reaches-top.spec.js`
  only (`noSlide`, a Flow-step spec this commit cannot reach); attempt 2 green.

## Not verified live

A real dead Pod hitting the 60 s delete: one can only be met by chance in a troubled DC.
The next one logs either `has no RunPod system log 60 s after its start` (worked) or
`pull check gave no answer` / `system log -> http N` (RunPod answers differently for a
dead Pod; the 8-min cap still deletes it).
