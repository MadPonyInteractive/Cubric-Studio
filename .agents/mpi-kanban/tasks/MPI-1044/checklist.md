# MPI-1044 checklist

Working list: brief.md § "2026-10-14 status check" and § Blockers.

- [x] Release Pod image v0.26.0 built (mpi-ci 5623d4e, CI run 38571331600: cpu + cu130 green), both tags
      pull-verified public: `docker.io/...:v0.26.0-cu130`, `ghcr.io/...:v0.26.0-cpu`. No `:latest`.
      CPU boot smoke not run (Docker daemon down), same as v0.24.0.
- [x] STABLE POD_IMAGE_VERSION / _CPU = v0.26.0 in routes/remotePodLifecycle.js (b18b587a7); npm test 3312/0.
      Shipped 2.0.1 apps keep v0.24.0 by exact tag until they update.
- [x] MPI-1097 fixed (35596affc, CI green); live proof in the Pod session.
- [x] MPI-951 old exe retired (aa76d4b6f + mpi-ci 6ab9048); release note cfba66dc8.
- [x] MPI-1139 single picture gets the grey-card sheet (38b1d9d9c); Fabio's eye check pending.
- [x] UNRELEASED.md: engine line vs 4.88 GB encoder (fa399f34f), background-jobs line, old-exe line.
- [x] MPI-1104 / MPI-1105 / MPI-1110 closed; MPI-740 fader is dev-only (Components page), not a 2.1 item.
- [x] Wait for Character Sheet Editor (MPI-1086) and Make seamless (MPI-1101); if either adds an
      installRequirements:true node, rebuild the Pod image (v0.26.1). 2026-10-14: Make seamless DONE;
      Character Sheet Editor still in doing. No node_lock change from either so far: no rebuild.
      2026-10-18: MPI-1086 DONE (2026-10-18 18:33). `dev_configs/node_lock.json` has no commit since
      2026-10-14: no rebuild, v0.26.0 stands. Latest ComfyUI release is v0.41.0 (< v0.42.0): no engine
      bump, the Pod session runs as written below.
- [x] 2026-10-18 Fabio overrode the >= v0.42.0 rule: bump to **v0.41.0** now (FLUX.3 Klein floor; MOSS-Image
      still needs v0.42.0 later). Breaking-surface pass 0.39.0..0.41.0: nothing our workflows or 22 node pins
      use; H3 "less tearing" NOT found in any commit. Pins f3feef36b (core 98cc0bf8, frontend 1.55.17,
      templates 0.11.84, system_dependencies 0.41.0, POD_IMAGE_VERSION_DEV/_CPU_DEV v0.27.0-dev);
      mpi-ci b376b18 synced. Fabio's app upgraded in place to 0.41.0 (~20 s, 0 IMPORT FAILED);
      `engine-floor-check` 251 class_types, 0 missing. Bench G:\ComfyUi on v0.41.0 (+clip_vision,
      model_patches, speech_to_text yaml keys; backup .bak-v0390), 0 import failures, left running.
- [x] Dev image v0.27.0-dev: CI run 39159379516 both legs green; `docker manifest inspect` OK on
      docker.io ...:v0.27.0-dev-cu130 and ghcr.io ...:v0.27.0-dev-cpu.
- [x] 2026-10-18 full smoke `--all --flows all` on v0.27.0-dev (Fabio's go in session 7's chat):
      evidence `dev_configs/smoke-evidence.json` 21:34Z = **PASS 65 · SKIP 1 (flux-schnell-cloud, no
      graph) · FAIL 0**, engine want/got 0.41.0 proven. Run log `dev_configs/smoke-run.txt`. Three runner
      bugs fixed on the way (tests 75/75): volume sized GiB-as-GB (410 GB vs 420.3 needed, refused before
      any GPU) + grow an undersized smoke volume in place; Transcribe's text-only output counted as "no
      media" (now counted on a graph with no media node; empty SRT of the silent probe passes, proven
      on the 0.41.0 bench first); `--retry-failed` died on `flow` rows. Two Transcribe-only retries
      (Fabio's yes each). Spend ~$0.90 under the $5 cap. Volume wzeh9dxbru deleted (Fabio); RunPod has no
      Pods or volumes. Runner fix + evidence 785d54c73, master Tests green (39169667482).
- [x] 2026-10-18 RELEASE Pod image v0.27.0 (ComfyUI v0.41.0, wrapper 0.2.47; R2 dev = stable = git):
      mpi-ci b376b18, CI run 39169739755 both legs green, pullable (cu130 sha256:430507a9, cpu
      sha256:a65eeb34). STABLE POD_IMAGE_VERSION / _CPU = v0.27.0 (8f52de791); npm test 3404/0. cpu boot
      smoke PASS once Fabio started Docker: /health 200, wrapper 0.2.47 from R2 stable (sha = git).
- [x] MPI-1045 describe encoder, LOCAL half: real `startUniversalWorkflowInstall(['qwen3vl-abliterated-clip'])`
      into an EMPTY scratch models root downloaded it from R2, 5,242,481,504 B, sha256 45fe15d3... = registry,
      216 s (scratch deleted). Remote half partly seen: the 10-18 smoke logged `remote install engine:assets:
      fetching qwen3vl-abliterated-clip` onto the volume. Still owed: Describe on ComfyUI returning text on a Pod.
- [x] 2026-10-18 live session in Fabio's app, ~$0.10 of the $1 cap: MPI-1097 PASS (dev Pod left running,
      `nodev` restart recreated it on v0.27.0, volume re-synced, SDXL Realistic installed, nothing
      re-downloaded; MPI-1097 validation.md). MPI-1045 remote PASS: the dev Pod auto-installed the
      Describe encoder onto the empty volume, and on the release Pod "Describe Image / universal
      workflow imageDescribe" (ComfyUI describer) returned text twice. Pod + volume deleted (Fabio).
- [x] 2026-10-16 Fabio: MPI-1136 (Cosmo + MCP import a card from another project) and MPI-1154
      (Video Edit background change describes every kept subject) also block 2.1. MPI-1154 changes
      Video Edit, so the Pod smoke's Video Edit run covers it. 2026-10-17: both DONE, Fabio's eye test
      passed (MPI-1136 became `send_cards`: cards go OUT of the open project, by hand, kind, mark or
      newest; closed 878cb6e28. MPI-1154 closed cdd85078f).
- [ ] One Pod session on the v0.26.0 RELEASE image: `--flows all` smoke (360 Panorama, Render path, both
      Character Sheet Flows, Video Edit, Transcribe, Make seamless, Qwen 2.1), describe-encoder check
      (MPI-1045), MPI-1097 live proof. Price and run count to Fabio first. 2026-10-14: priced ~$2 on an
      RTX PRO 4500 (now first in GPU_ORDER), cap $5, Fabio said yes. The plain run is now changed-only
      (3bb6119e9), but THIS one is still the full set: third-party pins moved since 10-08. Needs Fabio's
      own app started `npm start nodev` (default profile = RunPod key; nodev = v0.26.0 release image).
      **FIRST, before pricing this session (Fabio, 2026-10-18): check the latest ComfyUI release**
      (`gh api repos/Comfy-Org/ComfyUI/releases/latest --jq .tag_name`, and confirm it has a
      `ComfyUI_windows_portable_nvidia.7z` asset). If it is **>= v0.42.0**, suggest to Fabio that
      we bump the engine first (`/mpi-bump-engine`, pinned at v0.39.0 today), then run this session
      as the bump's full smoke (`--all` plus every Flow). One bump and one smoke then cover 2.1, and
      2.2 can bring MOSS-Image (MPI-1180, needs v0.42.0) and FLUX.3 Klein (MPI-1181, needs v0.41.0)
      without a second bump. The bump means a Pod image rebuild and a new STABLE pin, and every op
      re-runs, so the ~$2 price no longer holds: re-price with `--plan`. Fabio decides. If v0.42.0
      is not out, run this session as written above.
      2026-10-18: the `--flows all` half is DONE by the v0.27.0-dev smoke above. Still owed here: the
      describe-encoder check (MPI-1045) and the MPI-1097 live proof, plus the clean RELEASE image.
- [x] 2026-10-19 Fabio: bump to **v0.42.1** before tagging 2.1 (it carries the Stop-crash fix #17178, which
      replaces the known issue). Pins e91ac4979 (core 63be2f9b, frontend 1.55.18, templates 0.11.89,
      system_dependencies 0.42.1); no torch line moves, python_deps header only. Engine-line note restored
      989bff8ef. Breaking-surface pass 0.41.0..0.42.1: no mesh nodes in our graphs; ce1e922d8 moves the Qwen
      think-block, net-same conditioning for Krea 2 / Qwen-Image 2.1 / Boogu, but TextGenerate (Enhance,
      Describe) may now reason before answering (parser strips it): eye-test Enhance + Describe once.
      Local gate: MPI-1194 scratch portable moved in place git-less via shipped `comfyCheckoutSteps`
      (3 pip pkgs), curated set installed, booted `--cpu` on 48199 (48188 = Fabio's engine, busy with the
      video session): 0 IMPORT FAILED, floor 252/252. Bench G:\ComfyUi v0.42.1 (.bak-v0410), 252/252,
      left running. npm test 3414/0. release:check refuses until the new smoke (expected).
- [x] 2026-10-19 Pod half (Fabio's go, cap $5): mpi-ci 8afac83 synced; dev image v0.28.0-dev (CI
      39217855161, cpu boot smoke PASS on R2 dev) pinned 89c04ace9. Fabio's app restarted: engine moved in
      place to 0.42.1 in 20 s (3 pip pkgs, 0 IMPORT FAILED, floor 252/252); his Video Edit eye test done.
      Smoke `--all`: **PASS 65 · SKIP 1 (flux-schnell-cloud) · FAIL 0, 18/18 Flows**, engine want/got
      0.42.1 proven, RTX PRO 4500 (evidence 0c11b4cdc). Both Pods deleted (204); volume cavs1zgt5a
      (440 GB) KEPT, Fabio to decide. RELEASE image v0.28.0 (CI 39229329527, cu130 sha256:571746b9, cpu
      sha256:2df0139c, cpu boot smoke PASS on R2 stable), stable pins a7be64bcc. release:check passes.
- [x] Stamp 2.1 (`/mpi-version-bump`), `release:check`, `/mpi-release`.
      2026-10-19 Fabio approved the body (Gate 2); v2.1.0 PUBLISHED --latest at tag 4a52fb289. Verified via
      `releases/latest`: tag v2.1.0, draft false, prerelease false, 6 assets `uploaded`, each byte size equal
      to D:/CubricStudio/Vision/Builds/v2.1.0. Issue #10 (Stop crash) was already closed.
      Cleanup approved by Fabio (volume cavs1zgt5a, D:/scratch-mpi1194, D:/CVTest/CubricVision-v1.5.0-to-v2.1.0)
      but NOT done by the agent: the key is only reachable through his :3000 app (classifier refused) and the
      rm safety check refused the D:\ top-level folders. Left to Fabio (RunPod console + Explorer).
- [x] Same day: Claude Desktop bundle 0.3.2 (public steps need Fabio's yes), website guides (MPI-1124).
      2026-10-19 Fabio's yes. Bundle: manifest 28 tools == routes/mcp.js TOOLS (new since 0.3.0: import_media,
      send_cards); packed with mcpb@2.1.2 (3 files), released mcpb-v0.3.2 --latest, both the versioned and
      releases/latest download hash to cff13def…; cubric-studio-agents server.json 0.3.2 at 5230827, `mcp-publisher
      validate` OK; the registry `publish` is Fabio's one line (device-code login, classifier blocks the agent).
      Guides: every "2.1" line true against the shipped notes, competitor facts re-checked on GitHub (A1111
      v1.10.1 Feb 2025, Forge last push Jul 2025, Fooocus LTS); merged into website main c5c9704 and pushed.
      Still owed: Enhance + Describe eye test on 0.42.1 (Fabio, should have preceded the cut); IndexNow/Bing
      re-crawl ping (Fabio's call).
