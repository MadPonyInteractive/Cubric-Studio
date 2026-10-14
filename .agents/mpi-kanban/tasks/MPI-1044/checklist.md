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
      installRequirements:true node, rebuild the Pod image (v0.26.1).
- [ ] One Pod session on the v0.26.0 RELEASE image: `--flows all` smoke (360 Panorama, Render path, both
      Character Sheet Flows, Video Edit, Transcribe, Make seamless, Qwen 2.1), describe-encoder check
      (MPI-1045), MPI-1097 live proof. Price and run count to Fabio first.
- [ ] Stamp 2.1 (`/mpi-version-bump`), `release:check`, `/mpi-release`.
- [ ] Same day: Claude Desktop bundle 0.3.2 (public steps need Fabio's yes), website guides (MPI-1124).
