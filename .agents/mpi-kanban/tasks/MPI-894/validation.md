# MPI-894 Validation

## Phase 1b - catalogue off GraphQL onto REST v2

Status: VERIFIED 2026-09-28 (session f3d8094a) - automated checks passed, then live in
Fabio's app (below). Uncommitted at time of writing.

Evidence:
- `grep -rn "_graphql\|createPodGraphql\|api.runpod.io/graphql" routes js services scripts tests`
  -> no hits. `grep -in graphql routes/` -> history comments only (8 lines), no code.
- `node --test` over the 24 test files that load runpodRemote / remotePodLifecycle /
  smoke-workflows / remoteEngine -> 198/198 pass. New in `tests/runpod-rest-v2.test.cjs`: the
  gpus call carries `include=AVAILABILITY&product=POD&cloud=SECURE&minCudaVersion=13.0`; the
  picker shape (`displayName/memoryInGb/securePrice/secureCloud`); per-DC stock taken from the
  CUDA-scoped gpus call, NOT the DC catalogue (an offered card with no >=13.0 host reads
  unavailable); `storageSupport` from `networkVolumeTypes`; a 401 throws (route -> 502).
- `eslint --max-warnings=0` on the six touched code/test files -> clean.
- Full `npm test`: 2197/2200; the one failure is a PEER's untracked MPI-961 test
  (`tests/canvas-display-rendition.test.cjs`, EBUSY unlinking a temp thumb), not this change.
- Schema source: live `https://api.runpod.io/v2/openapi.json` (GpuType, DataCenter,
  DataCenterAvailability, CatalogResourceAvailability; v2 create `gpu.id` is a free string).

LIVE, 2026-09-28 (Fabio restarted the app 18:50:37Z; route files last written 18:39Z, so the
new code was loaded): his screenshot of Remote -> EU-RO-1 GPU dropdown shows "RTX PRO 4000 ·
Low · 24GB VRAM · $0.57/hr" with NO RAM badge (the old GraphQL payload always rendered one),
and his selected RTX 2000 Ada as "Unavailable right now". `app.log` has zero `RunPod request
failed` lines since start, so both `/v2/catalog/*` reads answered 2xx with his key. Fabio: "I
don't see any change" - the pass condition (same list, prices, stock). Phase 1b verified.
Note: the panel is the REMOTE slide-over since MPI-751 (2026-09-15), not Settings - fixed in
docs/runpod-remote-engine.md, runpod-troubleshooting.md, bump-engine/01-smoke-run.md and the
mpi-bump-engine skill the same session.
Only RTX PRO 4000 is in stock on a CUDA-13+ host in EU-RO-1 at 19:50 local, so the smoke's
GPU_ORDER (5090/L4/3090/4090) would stop in `pickGpu` before renting - MPI-595's concern.

## 2026-09-29 - hot-store 524 + Pod identity (session acd968e8)

Root cause and fix: plan.md Current State. Evidence so far (no paid run yet):
- `node --test tests/pod-identity-hot-store.test.cjs` 7/7: server records the rented card at create (CPU flag too) and forgets it on disconnect; `/remote/pod/specs` names the tracked Pod over the caller's picker; arch follows the connected Pod; stage-on-connect sends ONE `async` request (deduped), none on a CPU Pod, none on a pre-async wrapper; a gen sends `priority`, polls until its files land, and a Stop ends the wait.
- Related suites 94/94; full `npm test` 2214 pass / 0 fail.
- Wrapper: `python cubric-vision-pod/wrapper/test_hot_store_async.py` passes (async answers before any byte copies, worker stages, a failed file leaves `pending`, priority reorders, blocking form unchanged). mpi-ci `57a31c0`, pushed; `publish-runtime.sh dev` live, dev manifest reports wrapper 0.2.45.
- NOT yet proven on a real Pod through RunPod's proxy; needs one paid GPU Pod with a network volume (none exists since the smoke volume was deleted).
- Pre-existing, not ours: `wrapper/test_manifest_stamp.py` fails on committed HEAD too (expects manifest schema 1, wrapper writes 2).

LIVE, 2026-09-29 (session 8feae052; Fabio approved, cap $0.60; spent ~$0.12). App on :3000 ran
fc8a7438f (`/remote/mode` carries `gpuTypeId`); Fabio's saved picker = RTX 2000 Ada.
- Fill: `gpu_lease.py run -- node scripts/smoke-workflows.mjs --models klein-4b --install-only` ->
  volume `fivsivyhms` 60 GB EU-RO-1, CPU Pod `2pjo5itkq0oiwe` installed 21 deps, no failures, deleted.
  While it was up: `/remote/pod/specs` = "No GPU (download)", `/remote/mode.gpuTypeId` = `__cpu__`,
  and NO stage-on-connect line (the MPI-539 guard reads the real Pod now).
- GPU leg by hand (`/remote/pod/create` RTX 5090, 62 GB floor) -> Pod `kpmt17d2gqe7mt`, $0.99/hr,
  created 23:35:20Z, ready 23:40:08Z (cold host image pull).
  1. Identity PASS: `/remote/pod/specs` -> RTX 5090, 32 GB VRAM, 93 GB RAM - the SAME answer when
     asked `?gpuTypeId=NVIDIA RTX 2000 Ada Generation`. Fabio: "this time I got the correct toast
     for an RTX 5090".
  2. Wrapper PASS: `/remote/comfy/status` `wrapperVersion: "0.2.45"` (dev runtime channel).
  3. Stage-on-connect PASS: after the universal-node install + ComfyUI restart (23:40:17Z), ONE
     line `hot-store: stage-on-connect queued 5/5 file(s) for 1 model(s)` (23:40:19Z). 0 x 524 in
     app.log for the whole run.
  4. App generation PASS: `/connector/generate` klein-4b t2i (lease-wrapped) -> card `t2i_009`
     "MPI-894 Pod hot-store test" in My Agent Tests, 1088x896, generationMs 7678; app.log
     `hot-store: 5 file(s) on Pod disk` (23:41:23Z) - the gen waited on the priority stage, no 524.
- Teardown: Pod delete -> 204 (23:41:57Z); volume DELETE -> 2xx, then a second DELETE -> 404
  "network volume not found"; `/remote/mode` inactive.
- Auto mode refused listing `/runpod/volumes` + `/runpod/pods` ("Production Reads"); the test ran
  without them (the runner's own create path + the volume id from app.log).
- `publish-runtime.sh promote` HELD to the 2.0 cut (Fabio 2026-09-29); why it is safe either way: plan.md Current State. MPI-595 Gate D carries it.
