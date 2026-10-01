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

## 1c GPU picker overlay (session 3b566727, 2026-09-29)

Decisions (Fabio): Min RAM + Auto-retry move into the overlay; ONE Video switch (> 24 GB VRAM);
no RAM/vCPU on tiles (v2 still has none, live openapi rechecked today); spec-sheet speed bar; 2.0.
- `tests/gpu-picker.test.cjs` 6/6 (filter, order, video > 24, selected + CPU survive, stock bars, table).
- `tests/runpod-rest-v2.test.cjs` 18/18 (`maxCount` added to the translation).
- `npm test` 2254 tests, 0 fail. eslint clean on every touched file (the tile's bare `<button>`
  flagged by `mpi/no-bare-form-control` -> moved into a new Primitive, `MpiGpuTileGrid`).
- `tests/desktop/runpod-settings-extract.spec.js` 1/1 (panel mounts; AutoRetry group dropped from its loop).
- Visual: rendered `MpiGpuPicker` in an own `app:isolated` (port 52379) with 13 sample cards:
  tiles, stock meters, speed bars, selected highlight, Video switch -> CPU + 32 GB+ cards only.
- NOT self-verifiable: the panel -> overlay -> pick -> Connect path needs a RunPod key, which an
  isolated profile does not have. That is Fabio's eye-test in his own app.
- Speed table: 44 RunPod ids, datasheet dense FP16 TFLOPS (research sub-agent, sources per row in
  the session transcript). Caveats: GeForce = FP16-accumulate; L40 datasheet 181 vs L40S 362 on
  the same chip, unexplained by NVIDIA; RTX PRO 6000 Server ~470-504 (used 500).

### 1c eye-test round 1 (Fabio, 2026-09-29): three fixes
1. Auto-retry ON showed 3 tiles in EU-RO-1: the builder listed only the cards the DC's own
   catalogue named, and RunPod drops a sold-out card from that list. Now `catalogueCards`
   (js/data/runpodGpuSpecs.js) lists EVERY Secure Cloud card with this DC's stock; the switch is
   the filter. Test: gpu-picker `catalogueCards` case (7/7).
2. Refresh button + "checked HH:MM:SS" stamp in the overlay (stock was read on open only).
3. Closing ANY body overlay reset the slide-over's scroll to the top. Root cause: MpiOverlay's
   stash (display:none + re-parent) drops every scroll position; proven in the isolated app
   (raw stash: 240 -> 0). Fix in MpiOverlay (TRAP 4): record scrolled boxes before the stash,
   restore after unstash. Live: slide-over 240 / landing list 1500 -> same after open+close.
- npm test 2256 / 0 fail; desktop overlay specs 17/17 (flow library, queue hotkey, model settings,
  popup contract, radial x6, runpod panel, workspace sweep x4, gallery drop overlay).

### 1c eye-test round 2 (Fabio, 2026-09-29)
- Refresh is now the Libraries' control: MpiButton icon `refresh`, ghost, md, at the filter row's end.
- In-stock tiles: green edge (accent-ok 60%) + surface-2 ground; out-of-stock opacity 0.5. Checked in the isolated app.
- "Choose a GPU, then can't connect": NOT the picker. EU-RO-1 has no network volume (the live Pod test deleted it), and Connect is gated on one for a real DC (pre-existing, `_applyEngineStatus`). The panel now SAYS so under Connect ("Create a network volume above to connect, or pick Any region"), cleared when the reason goes.
- lint clean; gpu-picker + rest-v2 25/25; desktop runpod panel + popup-contract 2/2.


### 1c closed + ephemeral-in-a-DC (session 726c00ac, 2026-09-29)
- Fabio's final look: overlay colours and the Refresh button okay. 1c ticked.
- He then asked why a DC with no volume cannot connect ephemeral. It was a UI gate only: the server
  already builds a DC-pinned volume-less Pod (`_createPodInternal`: ephemeral = no volume,
  `dataCenterIds` still set; MPI-135's any-region steering already used it). Fix (his call: confirm
  popup): Connect enabled with a GPU; a fresh create in a DC with no volume asks first (MpiOkCancel
  "No network volume", OK = Connect); a warm podId resumes without asking; the CPU download Pod still
  refuses ("Download mode needs a network volume: create one above."). `containerDiskGb` now rides every
  volume-less create, twin in `js/shell.js` (boot auto-connect + auto-retry wait).
- eslint clean; RunPod unit tests 31/31; npm test 2258 pass / 0 fail.
- Live, own instance (CUBRIC_PORT free port, fresh profile, no RunPod key; state set by hand):
  EU-RO-1 + RTX 4090 + no volume -> Connect enabled, no hint; click -> the dialog text above, Cancel/Connect;
  CPU -> Connect disabled + the download-mode hint. Cancelled, no Pod made.
- NOT self-verifiable: OK -> a real Pod in EU-RO-1 (needs his key, and bills).
- Fabio 2026-09-29, his own app after restart: the "No network volume" popup over EU-RO-1 (screenshot), "1".
  Whether he pressed Connect was not reported: the DC-pinned volume-less create itself is the pre-existing
  server path (MPI-135 steering), not new code.
- `.claude/rules/components.md`: one line, "Scroll survives an overlay" (TRAP 4), on Fabio's explicit yes.
- 2026-10-01 (session ff52b7be, Fabio's ask): `minRamGb` default 62 -> 0 (auto) in `js/core/storage.js`; no floor is sent when 0 (MpiRunpodSettings.js:518, shell.js:983, unchanged). Saved configs keep their value (not migrated). No doc or test stated 62; `npm test` 2661 / 0 fail; eslint clean. The smoke runner keeps its own `MIN_RAM_GB` 62 (agent tool, not the user default).
