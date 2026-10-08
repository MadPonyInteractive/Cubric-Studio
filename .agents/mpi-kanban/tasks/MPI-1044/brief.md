# MPI-1044 - Release 2.0.2 readiness (umbrella)

Fabio, 2026-10-08: the next release is **2.0.2** (app is on 2.0.1). It ships the engine bump to
ComfyUI 0.39.0 from MPI-1043 (local half and Pod smoke done: 39 pass, 3 skip, 0 fail on the
v0.25.0-dev image, `dev_configs/smoke-evidence.json`, commit d27b5d8ba).

Release flow: `/mpi-version-bump` (stamp 2.0.2), then `/mpi-release`. One release per change,
from master.

## Blockers - every one closes before the cut

- [ ] **Scoped smoke: Qwen-Image 2.1 (MPI-936) + 3D scene (MPI-623)**, `--flows all`, on the
      v0.25.0-dev Pod image, once both cards' graphs land. Fabio said yes to running it; the
      price and run count still go to him before anything is rented. The 2026-10-08 matrix
      did NOT execute Qwen 2.1 (both ops skipped: workflow not landed), although
      `release:check` prints "covers all 40 models" - see MPI-1043 brief § Noticed.
- [ ] **Pod lock sync:** `c:\AI\Mpi\mpi-ci\cubric-vision-pod\node_lock.json` MpiNodes to the
      app pin (`dev_configs/node_lock.json`; 3ec03efb on 2026-10-08, MPI-623 may move it
      again). Code-only, no rebuild by itself - do it right before blocker 3.
- [ ] **Clean RELEASE Pod image rebuild** at v0.25.0 (`/build-pod-image`), pull-verify both
      tags, then move the STABLE `POD_IMAGE_VERSION` / `POD_IMAGE_VERSION_CPU` pair in
      `routes/remotePodLifecycle.js` (still v0.24.0 = ComfyUI 0.34.0). Mandatory after an
      engine bump: without it a 2.0.2 user runs 0.39.0 locally against a 0.34.0 Pod.
- [ ] **The ComfyUI describe encoder reaches both engines (MPI-1045).** `qwen3vl-abliterated-clip`
      (4.88 GB) became an `engineAsset` and the Image Describer plugin is gone; proven by unit
      tests only. Ride blocker 1's Pod session, no extra rent: after connect the volume holds
      `text_encoders/qwen3vl_4b_abliterated_fp8_scaled.safetensors` (`_installRemoteEngineAssets`)
      and a right-click Describe on ComfyUI returns text. Local: an `app:isolated` engine missing
      the weight downloads it at start (`/engine/repair-deps`).
- [ ] **Release-note copy agrees with itself.** `UNRELEASED.md`'s engine line says first launch
      takes "about a minute, with no full re-download", but a user without Krea 2 also downloads
      the 4.88 GB describe encoder on that launch (the MPI-1045 Fixes line). Reword one so they
      agree, at the `/mpi-release` copy review.
- [ ] **Stamp 2.0.2** (`/mpi-version-bump`) and `npm run release:check` green, then
      `/mpi-release`.

## Related, not owned here

- MPI-1043 (engine bump) closes with blockers 2-3 done.
- MPI-936 (Qwen 2.1), MPI-623 (3D scene), MPI-1036 (Video Edit Flow), MPI-1042 (character
  sheets) were unblocked by the engine bump; whether each ships in 2.0.2 is Fabio's call.
