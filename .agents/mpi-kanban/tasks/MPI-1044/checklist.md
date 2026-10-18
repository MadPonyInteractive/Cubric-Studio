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
- [ ] Wait for Character Sheet Editor (MPI-1086) and Make seamless (MPI-1101); if either adds an
      installRequirements:true node, rebuild the Pod image (v0.26.1). 2026-10-14: Make seamless DONE;
      Character Sheet Editor still in doing. No node_lock change from either so far: no rebuild.
      Fabio: the Pod session runs only once BOTH are finished (his yes covers ~$2, cap $5).
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
- [ ] Stamp 2.1 (`/mpi-version-bump`), `release:check`, `/mpi-release`.
- [ ] Same day: Claude Desktop bundle 0.3.2 (public steps need Fabio's yes), website guides (MPI-1124).
