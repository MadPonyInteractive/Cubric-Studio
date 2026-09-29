# MPI-894 Plan - Remote GPU estate

> **Umbrella created by `/mpi-project-refresh` on 2026-09-22 (MPI-893).** These cards were
> already on the board and stay there; this card is the shared context and the running
> order, not a replacement. Nothing here has been re-scoped - read each member's own card
> before touching its files.

## Members

| Card | Title | State |
|---|---|---|
| MPI-806 | RunPod REST v1 -> v2 migration (v1 returns 410 Gone on 2026-11-15) | `todo` / `planned` |
| MPI-668 | Nothing checks the Pod's ComfyUI core against node_lock, so a stale image surfaces as a rejected prompt mid-generation | `todo` / `planned` |
| MPI-541 | Unexplained OOM on one no-GPU download Pod - the download transport is exonerated, cause still unknown | `todo` / `blocked` |
| MPI-349 | Remote GPU capacity watch - RunPod deploy-when-available, network volumes, Vast.ai | `todo` / `research` |
| MPI-183 | Bump Builder image ComfyUI v0.25.1 -> v0.27.0 (parity with app+Pod) | `todo` / `deferred` |

## Why these belong together

All five live on the same seam: the app talking to a GPU that is not this box. They share
`docs/runpod-remote-engine.md`, the `wrapper/` runtime, the Pod image in `mpi-ci`, and the
`/runpod/*` routes. Done separately, each one re-learns the same Pod lifecycle and each one
rents its own Pod to find out.

**One member carries a hard external date.** MPI-806: RunPod REST v1 returns `410 Gone` on
**2026-11-15**. That is not a preference, and it sets the order below - everything else that
touches a `/runpod/*` call is cheaper written once against v2 than twice.

## Phases

1. **MPI-806 first, alone.** The v1 -> v2 migration rewrites the call surface the other
   cards build on. **Verify:** every `/runpod/*` route exercised against v2, and
   `GET /runpod/pods` still lists without renting (a `POST` RENTS - see
   `tool_probe_a_runpod_pod_for_ground_truth.md`).
1b. **GraphQL -> REST v2 for the picker catalogue — a 2.1 BLOCKER** (Fabio 2026-09-27: not
   in 2.0, must be in 2.1). RunPod retires GraphQL in **early 2027** (docs.runpod.io/
   release-notes). 2.0 already creates every Pod through v2 (MPI-806 moved the RAM-floor
   create off GraphQL); what is left is `client.gpuTypes` + `client.dataCenters`
   (`routes/runpodRemote.js`: price, per-DC RAM `lowestPrice`, stock) -> `/v2/catalog/gpus`
   and `/v2/catalog/datacenters?include=GPU_AVAILABILITY`, then delete `_graphql`,
   `createPodGraphql` and the dormant MPI-159 enum fallback. **Verify:** `grep -n graphql
   routes/` is empty, and the Settings picker shows the same cards, prices, RAM and stock
   for EU-RO-1 as before.
   **Pulled forward, Fabio 2026-09-28: 1b runs BEFORE the 2.0 B1 smoke (MPI-595).** Design
   agreed in the MPI-595 session: `client.gpuTypes` -> `GET /v2/catalog/gpus?include=
   AVAILABILITY&product=POD&cloud=SECURE&minCudaVersion=13.0` (availability scoped by the
   SAME CUDA floor the create sends); `client.dataCenters` -> `GET /v2/catalog/datacenters`
   with each DC's `gpuAvailability` built from the gpus call's per-DC `dataCenters[]`;
   translate at the boundary into the shape the renderer already reads (`displayName`,
   `memoryInGb`, `securePrice`, `available`, `stockStatus` HIGH->High/MEDIUM->Medium/
   LOW->Low, `storageSupport` = networkVolumeTypes non-empty) so no renderer file changes;
   delete `_graphql`, `createPodGraphql`, the MPI-159 enum fallback in `_createPodInternal`;
   fix the smoke runner's `selectGpu` (its "in stock" is a GLOBAL cheapest-offering RAM
   figure, not EU-RO-1 availability). **v2's catalogue has NO system RAM or vCPU** (checked
   the live openapi 2026-09-28): the picker's RAM badge goes (it self-hides on null); the
   create's `minRamPerGpu` floor still guarantees RAM. Fabio said go on that plan.
1c. **GPU picker becomes an OVERLAY that mimics RunPod's deploy page** (Fabio 2026-09-28,
   screenshot in the MPI-595 session). The dropdown becomes a button that opens an overlay
   like the model-selector and Flow-selector overlays. One tile per card: name, $/hr, VRAM,
   RAM + vCPU, `max`, and the three-bar availability meter (v2 `availability` NONE/LOW/
   MEDIUM/HIGH). RunPod's "Available | All" tabs are replaced by our **auto-retry switch:
   ON shows all cards, OFF shows only available ones**. Plus an **Image / Video filter**
   that shows only the cards that suit that kind of work. **Open, decide before building:**
   (a) RAM + vCPU on the tiles have no v2 source (see 1b); keep one GraphQL read until
   RunPod adds it (GraphQL retires early 2027), or ship tiles without RAM. (b) What "good for
   video / good for image" means has to be written down: the only rule today is the
   picker's `< 64 GB RAM ⚠ video`, which needs RAM; a VRAM-only rule, or the footprint of
   the models the user has installed, are the candidates. (c) 2.0 or 2.1: not stated.
   Frontend: EVERY UI element is a component (`ComponentFactory.create`), BEM, CSS vars;
   read `.claude/rules/components.md` + the existing model-selector overlay first.
   **DECIDED (Fabio 2026-09-29, session 3b566727):** (a) no RAM/vCPU on tiles (v2 still has
   neither, rechecked live); the **Min RAM floor and the Auto-retry switch MOVE into the
   overlay** and leave the Remote panel. RAM cannot hide tiles (no per-card RAM), it stays
   the create's `minRamPerGpu`. (b) ONE **Video** switch: on = cards with **> 24 GB VRAM**,
   off = all (no Image chip). (c) **2.0.** Plus a **spec-sheet speed bar** (dense FP16
   tensor TFLOPS, labelled "spec sheet, not measured"; no bar for a card not in the table).
   Measured per-card speed = record the Pod's card on each generation, a later card.
   Build: new Compound `MpiGpuPicker` (overlay), table `js/data/runpodGpuSpecs.js`,
   `_toPickerGpu` adds `maxCount` (secure). Verify mode: **user-ux** (Fabio eye-test).
2. **MPI-668 + MPI-183 together.** Both are engine-parity: MPI-668 adds the missing check
   of the Pod's ComfyUI core against `node_lock.json`, MPI-183 bumps the Builder image to
   the version that check would demand. **Verify:** a deliberately stale image is REJECTED
   by the new check with a message naming the pin, not a downstream node error.
3. **MPI-541 once a Pod is already up for 2.** The no-GPU download-Pod OOM - the transport
   is already exonerated, so this is measurement, not a fix. **Verify:** the OOM either
   reproduces with a named cause or the card is closed as not-reproducible with the
   evidence attached.
4. **MPI-349 last.** Capacity/availability policy is only worth writing once the API and
   the image are settled. **Verify:** a written recommendation, not code.

## Parallel Batch

Phase 2 only. Nothing else here is parallel-safe: 1 blocks everything and 3 wants 2's Pod.

- **MPI-668** - owns `wrapper/`, the Pod-side core check, `docs/runpod-remote-engine.md`.
- **MPI-183** - owns the `mpi-ci` Builder image definition.

Both read `dev_configs/node_lock.json`; NEITHER writes it. A pin change is
`/mpi-bump-engine`, a different card.

## Traps already known

- `POST /runpod/pods` **rents a GPU**. List with `GET`.
- `publish-runtime.sh stable` lands untested on released users. `dev` -> restart -> test ->
  `promote`, per `docs/runpod-remote-engine.md` § 5. A wrapper change is NOT an image rebuild.
- Size a volume in **decimal** GB.
- `guard-runpod-create.py` gates pod creation, and as of this refresh it finally binds the
  PowerShell tool too.

## Current State

2026-09-29 (session 3b566727) - **1c BUILT, self-verified, awaiting Fabio's eye-test** (verify
mode user-ux). New: `js/components/Compounds/MpiGpuPicker/` (overlay: Auto-retry, Video, Min RAM,
tiles), `js/components/Primitives/MpiGpuTileGrid/` (the tiles; a Primitive because a tile is a
button), `js/data/runpodGpuSpecs.js` (`GPU_TFLOPS`, `visibleGpuCards`, `stockBars`),
`tests/gpu-picker.test.cjs`. `MpiRunpodSettings`: GPU dropdown -> summary line + **Choose GPU**;
Auto-retry plate and Min RAM row removed from the panel; the old dropdown `change` body is now
`_onGpuPicked` (same four branches), `_buildGpuOptions` -> `_buildGpuCards` (all cards, the overlay
filters). `_toPickerGpu` adds `maxCount`. Docs: runpod-remote-engine.md, docs/agent/runpod-setup.md.
Next: Fabio restarts his app, eye-tests, then close 1c (commit via handoff/end-session).
Eye-test round 1 fixed (same day): Auto-retry ON now lists the WHOLE Secure Cloud catalogue
(`catalogueCards`; the DC's own list drops sold-out cards), a Refresh button + checked stamp, and
MpiOverlay keeps the scroll of everything it stashes (TRAP 4 - every body overlay had the bug).
Eye-test round 2 fixed: Refresh is the Libraries' icon button (ghost, `refresh`) at the filter row's end; in-stock
tiles green-edged + lifted, out-of-stock 0.5; Connect now SAYS why it is off (Fabio's EU-RO-1 has no volume - the
live Pod test deleted it - so Connect was gated, pre-existing). **Next: Fabio's final look (restart his app), then
close 1c** (tick checklist, close-out asks about `.claude/rules/components.md` TRAP 4 line). Then MPI-970.
Open for Fabio: speed bar is LINEAR vs the fastest card listed (B200 2250), so 16-24 GB cards
draw short bars; the TFLOPS number sits beside it. Gallery demo for the two new components: not added.

2026-09-29 (session 8feae052) - **LIVE-PROVEN** on a real RTX 5090 Pod (~$0.12): specs/badge name
the rented card over the stale picker, wrapper 0.2.45, stage-on-connect queued ONCE, an app gen
staged its 5 files, 0 x 524; Pod + volume deleted. Evidence: validation.md.
**Promote HELD to the 2.0 cut** (Fabio 2026-09-29: "part of the release process"). Checked: stable
is what EVERY released build's Pod pulls at boot (1.5.0 = image v0.23.0, no channel env); the
stable->dev delta is exactly mpi-ci `b131c0a` + `57a31c0`; a 1.5.0/1.6.x app never sends `async`,
so it gets the old blocking ensure unchanged and ignores the two new dryRun keys; the chatterbox
link replaces only an EMPTY folder, never fatal. No harm, and no benefit before 2.0's app ships.
Tracked as an MPI-595 Gate D line. This card's own phases (2-4) stay open.

2026-09-29 (session acd968e8) - **both FIXED, unit-proven, not yet live-proven** (Fabio:
"fix it properly"). Identity: server `_mode.gpuTypeId` (remotePodState.js, set at
create/reconnect, cleared on disconnect); `/remote/pod/specs` prefers it over the query;
`remoteEngineClient.podGpuType()` feeds arch + the VRAM cap; both download-Pod guards read
`isDownloadOnly()`. Hot-store: wrapper 0.2.45 queues on `async: true` (mpi-ci `57a31c0`,
published to `dev`); app polls dryRun (3 min cap, Stop ends it), gen sends `priority`,
prefetch sends ONE request. Tests: `tests/pod-identity-hot-store.test.cjs`,
`wrapper/test_hot_store_async.py`. **Next:** a paid live run (GPU Pod + a network volume -
none exists), then `publish-runtime.sh promote` with MPI-595's release step.
2026-09-29 later: Fabio APPROVED the live run (cap $0.60, ~$0.30 expected), restarted his app
onto the new code, and OKed status GETs + one generation through it. The auto-mode classifier
blocked every `:3000` call ("Production Reads") despite that; rules for it were added to the
gitignored `.claude/settings.local.json` (3 Bash rules + one `autoMode.allow` line) and only
load in a FRESH session. Test shape: the smoke runner posts straight to `/proxy/prompt`, so it
exercises connect + stage-on-connect but NOT the per-gen preflight; add one real generation
through the app (`/connector/generate` klein-4b t2i) while the GPU Pod is up. Check: badge/
`/remote/pod/specs` names the rented card (Fabio's picker is RTX 2000 Ada), `/remote/comfy/status`
`wrapperVersion` 0.2.45, app.log shows `stage-on-connect queued` once and no 524, the gen logs
`hot-store: N file(s) on Pod disk`. Delete the Pod AND the test volume after.

Findings (2026-09-28 late, from the MPI-595 smoke). Evidence: `%APPDATA%\Cubric Studio\logs\app.log`
19:18-20:24Z.
- **Hot-store 524 every ~2 min.** Stage-on-connect went default ON on 2026-09-17 (MPI-802,
  `114ede346`). On every connect `prefetchInstalledModels` (commandExecutor.js ~590) walks
  every installed model (14) and sends one `/wrapper/hot-store/ensure` each; the wrapper
  (`mpi-ci/cubric-vision-pod/wrapper/wrapper.py` ~1329) holds that request open for the
  whole volume->disk copy + sha256 re-read. RunPod's proxy cuts a request at ~100 s -> 524.
  The 5090 finished each model in 20-45 s (fine); the A100 did not, so 8 x 524 at 125 s
  intervals. After a 524 the copy keeps running and holds `_hot_lock`, so the next request
  queues and 524s too - and so does a USER generation's own preflight ensure, which waits
  ~100 s then generates from the volume while the copy saturates disk (A100 i2v 281 s vs
  33 s). The loop ignores disconnect: 6 x 409 after the Pod was deleted, then logs
  "warmed 14 model(s)" having warmed none.
- **Wrong Pod identity ("RTX 2000 Ada").** The badge asks `/remote/pod/specs?gpuTypeId=
  <saved picker>` (shell.js ~1414); the route echoes the caller's id though it already
  reads the live Pod. The VRAM filter (`_remoteVramGb`) and BOTH `__cpu__` guards read the
  same saved pick. A Pod made over HTTP (`/remote/pod/create` - the smoke runner, or an
  outside agent per `.claude/skills/cubric-vision-engine`) never updates it. Result on
  19:18-19:22: prefetch staged 16-file sets onto the CPU download Pod (the MPI-539 hazard),
  and the install SSE went silent 90 s twice. Settings-made Pods do not diverge (a GPU
  switch there deletes the old Pod).

2026-09-28 (session f3d8094a): **1b DONE + live-verified in Fabio's app, uncommitted.** The
RunPod panel lives in the REMOTE slide-over since MPI-751 (docs said Settings; fixed).
Card `doing`/`in-progress`, claim `f3d8094a-mpi894`. `client.gpuTypes`/`dataCenters`/
`availability` now read `/v2/catalog/gpus` (scoped `include=AVAILABILITY&product=POD&cloud=
SECURE&minCudaVersion=13.0`) + `/v2/catalog/datacenters?include=GPU_AVAILABILITY`, translated
in `_toPickerGpu`/`_toPickerDcs`. `_graphql`, `createPodGraphql`, the MPI-159 fallback are
deleted. `POD_CUDA_FLOOR` moved to `runpodRemote.js` (catalogue + create share it). Smoke
`pickGpu` stamps `inStock` from EU-RO-1's `gpuAvailability`. Evidence: `validation.md`.
Gotcha: per-DC stock comes from the GPUS call, never the DC catalogue's own `availability`
(that ignores cloud + CUDA). Next: commit (handoff/end-session) -> MPI-595 B1 smoke with
Fabio present. At 19:50 local EU-RO-1 had only RTX PRO 4000 on a CUDA-13+ host, which is not
in the smoke's GPU_ORDER, so `pickGpu` stops before renting until stock changes (or --gpu).

Already landed from that session, as the first slice of the v2 work: the **CUDA floor fix**.
MPI-806 mapped v1's `allowedCudaVersions: ['13.0']` 1:1 onto v2, where that list matches
EXACTLY (openapi: "a version no machine reports yields a capacity error rather than a
fallback"), so every GPU create since 2026-09-27 was confined to hosts reporting exactly
13.0 and 13.1-13.4 hosts were shut out with the stock-out text. Now `podCudaFloor` returns
`'13.0'`, the spec carries `minCudaVersion`, v2 sends `gpu.minCudaVersion`. Tests 95/95 on
the RunPod files; **not yet proven live** (needs an app restart + a GPU create). The
GraphQL `createPodGraphql` was deliberately NOT updated for it: 1b deletes it.

## Plan Drift

- 2026-09-28: 1b pulled forward from 2.1 to before the 2.0 smoke; 1c added (picker overlay +
  image/video filter). Both Fabio's calls, same session.
- 2026-09-28 (1b build): the DC call also asks `include=GPU_AVAILABILITY`, used ONLY as the
  list of cards each DC offers. The openapi says a GPU's `dataCenters[]` is "omitted entirely
  when the configuration is unavailable everywhere", so building per-DC lists from the gpus
  call alone could drop a sold-out card from auto-retry's "will wait" list (MPI-110).
