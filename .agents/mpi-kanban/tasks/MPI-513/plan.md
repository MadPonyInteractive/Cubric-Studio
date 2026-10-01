# MPI-513 — Install state that lies to the user

Umbrella created by the `mpi-end-session` consolidation sweep, 2026-08-10. Four `todo`
cards, one shape: **what the install UI shows disagrees with what the store knows.**
(MPI-544 added by the 2026-08-14 sweep.)

**The member cards stay on the board.** Nothing was closed, merged or deleted to make
this. Close a member when the phase covering it lands, and say so in its card. If the
members turn out to be the better unit, delete this umbrella instead.

## Members

| Card | What it is |
|---|---|
| MPI-497 | An already-present dep still fires an "installed" toast on re-verify |
| MPI-397 | The install/uninstall card move lags seconds behind the toast — it waits on a disk read |
| MPI-320 | MPI-276 write-flip: retire the legacy `_modelJobs`/`_depJobs` maps, `installStore` becomes the single writer |
| MPI-544 | Install-toast spam — a burst of completion toasts for work that is not happening. `research`, NEVER REPRODUCED |

## Current State

2026-10-01 (Agent 83): card in `doing`, Phase 0 investigation done (findings below).
**Fabio approved the Phase 1 design (D1-D5) on 2026-10-01**, to be built in a fresh session,
tests first. No code changed yet. Next: write failing tests for D2 (two models on one dep —
both store jobs see the shared dep settle) and D4 (reconciler never moves an `installing`
job; its orphan-fail broadcasts `download:failed`), then start the flip with
`installStore.registerModelJob` reuse semantics. Re-read the source before trusting a line
number here: line refs are HEAD 6213881ce.
MPI-544 is the only member that is not a standing defect: it was seen once during the
2026-08-11 download-Pod incident and has never reproduced, so it is carded rather than fixed
— **no evidence, no speculative patch.**

## Phase 0 findings (2026-10-01, read of HEAD 6213881ce)

The two writers are worse than "map vs store", and three of the gaps are new since MPI-320
was written:

1. **Three model-level writers, not two.** `_checkModelJobsComplete` (map) settles a model;
   the reconciler's step 3 ALSO rolls a model to `done` and step 4 fails "orphans" — both
   store-only, with no `download:complete`/`download:failed` broadcast and no word to the
   transport. Concretely: a local model in `installing` (zips down, nodes extracting) has
   every node dep `complete`, so the reconciler moves it `installing -> done` mid-extract.
   That is MPI-317 F4's real root, and its F5 guard (`_setModelStatus` skips store writes
   once terminal) only hides it.
2. **The store's dep records are not shared.** `registerModelJob` REPLACES `_depJobs[depId]`
   with a fresh record, but the map shares ONE dep object across every model job that uses
   it (remote ATTACH, MPI-97). Two models on one weight: model A's store job keeps the old
   record, which no transition ever reaches again — its snapshot dep sits `downloading`
   forever. `transitionDep(depId)` only ever moves the newest record.
3. **Map status vocabulary the store cannot hold:** model `complete` (store `done`) and
   `idle` (disk-full refusal, set on a map job that is never registered and never deleted).
4. **Pull readers depend on map retention.** `/comfy/downloads/status` is map-backed and the
   map keeps finished jobs until cancel/uninstall. `scripts/smoke-workflows.mjs`
   `installProbe` returns "not done" for an ABSENT job, so on the store (which prunes a done
   job the moment disk truth confirms it) the smoke runner would wait out its 3 h budget.
   The agent skill docs also say "track via /comfy/downloads/status".
5. Scale: 53 map refs + ~38 status reads in `routes/downloadManager.js` (3,939 lines), both
   engines; 36 test files exercise the module, 4 poke `_modelJobs`/`_depJobs` directly.

## Phase 1 design (proposed, awaiting Fabio's go)

- **D1 One record set.** The module-level maps go. The store's records ARE the job objects;
  they carry the transport fields (url, localPath, sha256Expected, filename, error flags)
  as plain data — the store stays I/O-free. `FileDownloader` keeps its `depJob` reference.
- **D2 Shared dep records.** `registerModelJob` reuses a live dep record for the same depId
  (attach) instead of replacing it; a model job's `deps[]` holds the shared objects. A
  re-POST of a live model unions deps (today's map behaviour), never drops an in-flight one.
- **D3 Status only through the store.** Every `x.status =` write goes; `_setModelStatus` /
  `_setDepStatus` become thin store calls. `complete` -> `done` for models (the FE already
  maps both). `idle` dies: the disk-full gates refuse BEFORE registering.
- **D4 One model-level rollup.** `_checkModelJobsComplete` (reading store deps) is the only
  thing that moves a model to a terminal state and broadcasts it. The reconciler settles
  DEPS from truth and then calls an injected `onSettled` (that rollup) instead of
  transitioning models itself; its orphan-fail goes through the same terminal path so the
  user gets a real `download:failed` with a reason.
- **D5 Pull endpoints** serialize the store (live bytes included, since it is one object).
  Finished jobs: the smoke runner and agent docs learn "absent after seen = finished,
  confirm with check-local". `scripts/smoke-workflows.mjs` is MPI-894's file — message its
  owner, do not edit.
- **Deferred, named:** retiring the remote stall-watchdog into the reconciler and the G6
  local/remote adapter split. The watchdog is transport recovery (SSE reconnect, orphan
  re-issue, remote-inactive fail), not a status writer once D3 lands; folding it in is a
  separate refactor with its own risk. MPI-320 keeps both as follow-ups.

**Verify:** the 36 module tests + `install-store` / `install-reconciler` green; new tests for
D2 (two models on one dep, both settle) and D4 (reconciler never rolls an `installing` job);
live LOCAL install / cancel / resume / shared-dep install on an isolated instance; live
REMOTE resume on a Pod (costs money: price first).

## Why one card and not three

MPI-320 is the root and the other two are its symptoms. While two structures describe
one install — the legacy `_modelJobs`/`_depJobs` maps and `installStore` — the UI can
read one while the truth lives in the other. That is exactly a toast for an install that
did not happen (MPI-497) and a card that moves seconds after the toast that announced it
(MPI-397). Fixing either symptom on its own means teaching a consumer to distrust its
own source, which is the patch this repo's root-cause rule forbids.

So: MPI-320 first, then confirm 497 and 397 against the single writer rather than fixing
them separately. Both may simply stop.

## Phase 1: Single writer

MPI-320. `installStore` becomes the only writer; the legacy maps go. Sweep every
consumer in one pass — the map reads are spread across the install UI and the queue
panel, and a one-consumer fix on a shared primitive is a false done.

## Phase 2: Re-test the symptoms, do not pre-fix them

Re-run MPI-497 and MPI-397 against phase 1. Close whichever the write-flip already
fixed, and re-card only what genuinely survives, with the new evidence.

MPI-544 rides here for the same reason but with a weaker claim: it is the same shape as
MPI-497 (a toast announcing install work that did not happen), and its first candidate — a
MODEL-LEVEL `download:complete` re-broadcast when the install SSE reconnects and replays —
is a two-writer symptom, since the MPI-276 G9 snapshot protocol versions *deltas* and a
replayed terminal event is not a delta. **Do not go hunting it before phase 1 lands.** Two
dead ends are already ruled out and must not be re-walked: it is NOT the MPI-539 reconcile
path (the client drops `modelId: null` events, which is what that path broadcasts), and it
is not the abandon path (now terminal exactly once per model job).

If it fires again before phase 1, capture evidence BEFORE touching code: the `app.log`
download lines around the burst, and whether the SSE reconnected in that window.

Verification for both is user-visible timing, so it needs the app, not a unit test:
`/comfy/downloads/status` plus `/active` split "the client thinks" from "the server
knows" (memory `tool_read_download_state_without_console`).

## Parallel Batch

None. Phase 2 depends on phase 1 by construction — the whole argument for this umbrella
is that the symptoms cannot be judged until the single writer lands. Within phase 1 the
consumers are one file each but they share `installStore`, so a fan-out would contend
on it.

## Plan Drift

(none yet)
