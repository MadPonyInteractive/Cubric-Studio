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
