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

2026-09-28 (MPI-595 session 909b66b4): phase 1b NOT started; card still `todo`. Next session:
`beginImplementation` MPI-894 (todo -> doing, write `files.json`), then 1b per the design
above, then the MPI-595 B1 smoke (its handoff chain carries the smoke procedure).

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
