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

2026-10-01 (Agent 85): **Phase 2 re-test DONE — neither MPI-497 symptom was the two writers;
both survive Phase 1** (evidence: `validation.md` § Phase 2). Phase 1 is committed + pushed
(`5a8dc2d2a`). MPI-397 is untouched by construction (its residual is the `/comfy/models/check`
round trip, not the store) — stays Fabio's product call. Root fixes proposed, awaiting Fabio's go:
- **R1 (toast):** the rollup has no "downloaded now vs already there" signal. Mark a model job
  whose every dep was `complete` at registration; its `download:complete` carries
  `alreadyInstalled: true` and the FE re-syncs without announcing.
- **R2 (stale bar):** the 120 s / 30 s terminal-job belts never fire — the reconciler poll
  self-idles once nothing is active, and SSE connect only reconciles while something is active.
  So a `done` job is immortal until the next install or an app restart; after a remote install,
  a switch to local paints a 100% bar + Cancel on a model not installed here. Keep the poll
  running while terminal jobs await pruning; SSE connect always runs the (I/O-free) idle prune.
**R1 + R2 BUILT and verified** (Fabio: "it seems pretty important" = go): red/green unit tests,
`npm test` 2631/0, live on isolated `:50063` (re-install -> `alreadyInstalled:true`; the done job
left `/downloads/status` at 132 s with nothing else running). Evidence: `validation.md`.

## 2.0 owner list (Fabio 2026-10-01: two sessions own everything to the smoke; no card left aside)

Split proposed to "Release 2.0 blockers 27" (msg 37c4a3e4): they take MPI-918 (+ close MPI-985),
MPI-894 (Fabio's in/out on 668/183/541/349), then the MPI-595 cut, smoke LAST. This session owns:

- [x] Pod remote test DONE 2026-10-01 (Linux box, CPU Pod, ~$0.01; validation.md): attach, cancel, crash+resume, R1+R2 all pass on remote. It found (a) cancel starting a dead LOCAL downloader on a queued Pod dep - FIXED here (local pump skips remote records), (b) reconnect deleting a RUNNING Pod - handed to "Release 2.0 blockers 27" (holds remotePodLifecycle.js).
- [ ] MPI-513: R1/R2 committed `9c593af5f` (CI green); MPI-497 closed `f03d26905`; Pod remote-resume test (Fabio's pick: Linux box or fold into cut);
  close MPI-497 as fixed; MPI-397 = Fabio's product call (park after 2.0 is my pick); MPI-320's
  deferred follow-ups (stall-watchdog into reconciler, G6 adapter split) named for his in/out;
  MPI-544 already OUT of 2.0 (Fabio 2026-09-29).
- [x] MPI-866 close (done, `ee6e94d97`) (watcher opened + closed red-master issues #3, #4; Fabio got the pushes).
- [x] MPI-593 close (done, `ee6e94d97`): tick stale boxes, `llms.txt` decided, directory submission stays on MPI-595.
- [x] MPI-708 close (done, `ee6e94d97`): stale boxes ticked, the cut itself stays on MPI-595.
- [x] MPI-603 stays parked (handoff resolved, why-open noted, `ee6e94d97`) to AFTER 2.0 (v1.5.0 `models.js:1043` still installs the LoRA);
  resolve its stale handoff 779c959c.
- [x] `docs/releases/UNRELEASED.md`: MPI-1007 + MPI-894 picker bullet added (`ee6e94d97`); was GPU picker Gen speed bullet (missing).

2026-10-01 (Agent 84): **Phase 1 (D1-D5) is BUILT and verified** (one commit:
the pure modules are only correct together with the downloadManager wiring).

- `routes/downloadManager.js`: `_modelJobs`/`_depJobs` deleted. `_registerJob` is the only
  way in (local, remote, UW): resolve paths + disk/volume state first, run the disk-full gate
  (refuses BEFORE registering — no `idle`), then register and use THE store job object.
  `_setModelStatus`/`_setDepStatus` only call the store table; a write on a record the store
  replaced is ignored (logged). Model success is `done`. Reconciler wired with
  `onSettled: _checkModelJobsComplete` + `isTransportLive: _isDepTransportLive`. Pull
  endpoints read the store. Cancel drops its job (`dropModel`). Start paths run the rollup
  after responding, so an all-on-disk start settles (found live, see drift).
- Tests: `npm test` 2633 / 0 fail. New: 4 D2 store tests, D4 reconciler contract (7 new or
  rewritten), `tests/install-start-settles.test.cjs` (red without the fix, green with it).
  Harness fixes: FileDownloader tests register their dep in the store; the F5 guard test is
  replaced by a D3 one; the uninstall source-scan is scoped to the uninstall route.
- Live, isolated instance with BOTH `CUBRIC_ENGINE_ROOT` and `CUBRIC_MODELS_ROOT` in scratch:
  shared-dep attach (B's start shows the shared weight `downloading`, both settle `done`),
  cancel mid-flight (44 MB in → job gone; restart starts clean, as cancel deletes the
  partial), re-install of an on-disk model → `done` at once. app.log: zero illegal
  transitions, zero ignored-record lines.
- Docs: `docs/download-manager.md` (reconciler, one-record-set note, job storage, status
  endpoint), agent docs (`cubric-vision-generate` SKILL.md, `docs/agent-chat.md`) learn
  "absent after seen = finished". MPI-894's owner messaged about `installProbe`
  (message 1b701cfc).

**Next:** commit (handoff or end-session), then the live REMOTE resume on a Pod (costs
money — quote the price to Fabio first), then Phase 2 (re-test MPI-497 / MPI-397 in the app).

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

- 2026-10-01 (Agent 84): D4 needed a transport-liveness hook the design did not name. The
  orphan rule ("no bytes, no disk, 60s since last tick") also matches a model whose deps
  wait `queued` behind `LOCAL_DOWNLOAD_CONCURRENCY = 3` — `lastTickAt` only moves on a
  dep status change. Today that fails the STORE job only (no broadcast, transport carries
  on), so the snapshot can say `failed` for a download that is merely queued. Routed through
  the real terminal path it would be a user-visible false failure, so the reconciler now
  skips a job holding any `isTransportLive` dep.
- 2026-10-01 (Agent 84): `_setDepStatus` stamps `lastTickAt` on `depJob.modelId` only —
  with shared dep records (D2) that is the FIRST registrant. Stamp every model in
  `store.activeModelsForDep(depId)` when D3 rewrites it. (Done.)
- 2026-10-01 (Agent 84): the reconciler must NOT settle a dep the transport still holds: a
  local file is byte-complete while its sha256 is checked, and with one record set the old
  all-bytes-in heal would have announced the install before verify. `isTransportLive` gates
  step 2 too.
- 2026-10-01 (Agent 84): found LIVE — a start whose every dep is already on disk sat
  `downloading` forever. The old reconciler step 3 rolled such a store job to done; with D4
  nothing did. Root fix: the local and UW start paths run `_checkModelJobsComplete` (the
  remote path already did). Pinned by `tests/install-start-settles.test.cjs`.
- 2026-10-01 (Agent 84): the store's records are kept until a reconciler pass prunes them,
  and passes run only while a job is active / on SSE connect / after uninstall — so a
  finished `done` job usually stays listed (the store already behaved so; it is now also
  what `/downloads/status` shows). Cancel and uninstall drop at once.
- 2026-10-01 (Agent 84): the agent profile's custom models root is `G:/CubricModels`
  (`model_roots.json` in the repo's dev ENGINE root), which beats `CUBRIC_MODELS_ROOT`. The
  first live run therefore downloaded one real dep into it
  (`G:/CubricModels/vae/taeltx2_3.safetensors`, 22 MB, an LTX preview VAE); nothing was
  deleted. A live download test must set `CUBRIC_ENGINE_ROOT` to scratch as well.
