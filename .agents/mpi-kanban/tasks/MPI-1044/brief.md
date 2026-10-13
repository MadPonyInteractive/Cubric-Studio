# MPI-1044 - Release 2.1 readiness (umbrella)

**2026-10-10, Fabio: the release is 2.1, not 2.0.2** ("considering we have so much stuff that is coming out, we
might as well call it 2.1, so there's no problem in having the dev gate removed"). About eight agents were
working toward it. MPI-623's 3D Scene + 360 Pano Flow ship UNGATED in it (blocker below).

Fabio, 2026-10-08: the next release was **2.0.2** (app is on 2.0.1) - now 2.1, above. It ships the engine bump to
ComfyUI 0.39.0 from MPI-1043 (local half and Pod smoke done: 39 pass, 3 skip, 0 fail on the
v0.25.0-dev image, `dev_configs/smoke-evidence.json`, commit d27b5d8ba).

Release flow: `/mpi-version-bump` (stamp 2.1), then `/mpi-release`. One release per change,
from master.

## Blockers - every one closes before the cut

- [ ] **Scoped smoke: Qwen-Image 2.1 (MPI-936) + 3D scene (MPI-623)**, `--flows all`, on the
      v0.25.0-dev Pod image, once both cards' graphs land. Fabio said yes to running it; the
      price and run count still go to him before anything is rented. The 2026-10-08 matrix
      did NOT execute Qwen 2.1 (both ops skipped: workflow not landed), although
      `release:check` prints "covers all 40 models" - see MPI-1043 brief § Noticed.
      **2026-10-10: Qwen half done - Fabio ran Qwen 2.1 on RunPod by hand. 3D scene half remains.**
      Every other Qwen 2.1 leftover lives under umbrella MPI-1064.
- [ ] **Pod runtime publish, BEFORE blocker 1:** (2026-10-10: `publish-runtime.sh dev` done by
      MPI-1057, wrapper 0.2.46, carrying both lines; Pod restart + test + `promote` remain.) `./publish-runtime.sh dev` (never `stable`) carrying
      mpi-ci `6f43c26` (`moge`, MPI-623) and `c57f7dd` (`model_patches`, MPI-936), Pod restart, test,
      then `promote` (`docs/runpod-remote-engine.md` § 5). Both start.sh yaml lines are pushed but no
      Pod sees them until published: Qwen 2.1's `control` (its ControlNet lives in `model_patches`) and
      the 3D scene's MoGe silently produce nothing remotely. Same Pod session as blocker 1.
- [ ] **Pod lock sync:** `c:\AI\Mpi\mpi-ci\cubric-vision-pod\node_lock.json` MpiNodes to the
      app pin (`dev_configs/node_lock.json`; 3ec03efb on 2026-10-08, MPI-623 may move it
      again). Code-only, no rebuild by itself - do it right before blocker 3.
- [ ] **Clean RELEASE Pod image rebuild** at v0.25.0 (`/build-pod-image`), pull-verify both
      tags, then move the STABLE `POD_IMAGE_VERSION` / `POD_IMAGE_VERSION_CPU` pair in
      `routes/remotePodLifecycle.js` (still v0.24.0 = ComfyUI 0.34.0). Mandatory after an
      engine bump: without it a 2.1 user runs 0.39.0 locally against a 0.34.0 Pod.
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
- [ ] **The 3D Scene ships ungated (MPI-623).** Its plan § Paths P3 + Phase 4: the 360 Pano Flow built and
      smoked, MoGe HF re-host + `noMirror` dropped, `promote` after a Pod proves `start.sh`'s `moge` line,
      the `scene-convert` / `scene-path` plugins lose `devOnly`, every `APP_CONFIG.dev_mode` Scene gate off,
      `sceneLift` deprecated, Fabio's end-to-end eye check.
- [ ] **Stamp 2.1** (`/mpi-version-bump`) and `npm run release:check` green, then
      `/mpi-release`.

## After the cut - the same day the 2.1 release is public

- [ ] **Publish the website guides (MPI-1124).** In `c:\AI\Mpi\Cubric Studio (Website)`, merge branch
      `guides-mpi-1124` into `main` and push (Pages = live). Held for 2.1 by Fabio (2026-10-13): the
      guides describe 2.1-only features (the under-18 refusal, Qwen-Image 2.1, Character Sheet from
      Images / Editor, the 360 Pano Flow). Re-read each "from 2.1" line against what actually shipped,
      then ask Fabio before the IndexNow / Bing re-crawl ping (MPI-1124 brief, Open item 4).

## Related, not owned here

- MPI-1043 (engine bump) closes with blockers 2-3 done.
- MPI-936 (Qwen 2.1), MPI-623 (3D scene), MPI-1036 (Video Edit Flow), MPI-1042 (character
  sheets) were unblocked by the engine bump; whether each ships in 2.1 is Fabio's call (MPI-623: yes,
  ungated, 2026-10-10).
