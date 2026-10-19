# MPI-1203 validation

## Root cause

With a download-mode (CPU) Pod connected, `generationService._laneOf` parked a Cue job's
intent on the `remote` lane (`isRemote()` is true). commandExecutor ran the job on `local`
(MPI-539: `forceLocal || isDownloadOnly() ? 'local' : ...`). The store fired the local lane's
drain callback, so the remote intent never cleared. The result was one RUNNING row that never
moved, every later job pending behind it, an IDLE status bar, and nothing in app.log. The
first job after connecting ran and saved; only the queue behind it wedged. This matches
Fabio's 2026-10-19 report: CPU Pod `074dudlwuflv7n` connected 12:51-13:18 UTC, upscales
stuck in that window. Shipped in 2.1.1 (`git show v2.1.1:js/services/generationService.js`, line 125).

## Fix

- `_laneOf` returns `local` for a download-only Pod, so it mirrors the executor again.
- `_dispatchNextCue` logs `holds the <lane> lane with no <lane> store job` when a dispatched
  intent has no store job on its lane after 30 s, so the next wedge of this class leaves a trace.

## Evidence

- `node --test tests/cue-dispatch-stall.test.cjs`: 2/2 pass in 0.2 s.
- With the one-line fix reverted, test 1 fails: "the second job left the queue: the first
  one's lane was freed". Test 2 fails too, because the intent then sits on `remote`.
- `npm test`: 3421 tests, 3419 pass, 0 fail.

## Release notes (for whoever folds UNRELEASED.md; that file is claimed by the 2.1 release session)

- **Upscales and other jobs no longer stall in the queue while a download-only RunPod is
  connected.** The first job ran, then every job behind it waited forever. (MPI-1203)

## Not done

Not checked in the live app with a real CPU Pod. That costs Pod time, and the unit test drives
the real queue module with the Pod's state stubbed.
