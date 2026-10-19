# MPI-1193 checklist

- [x] Route decided: ship 2.1 on 0.41.0 as is (Fabio, 2026-10-19); fix rides the MOSS bump (MPI-1180)
- [x] DROPPED, no pin change: node_lock.json core tag+commit+frontend, system_dependencies.json engine.version agree
- [x] DROPPED, no pin change: Fresh Windows / uv installs land on the pinned commit (version-check sees commit drift, boot gate moves it in place)
- [x] DROPPED, no pin change: Pod Dockerfile clones a commit, DEV image rebuilt, POD_IMAGE_VERSION_DEV bumped
- [x] DROPPED, no pin change: Local floor check on the new engine exits 0
- [x] DROPPED, no pin change: Pod smoke green, smoke-evidence.json written (cost stated first)
- [x] DROPPED, no pin change: Local Stop at ~60% of Qwen-Image 2.1 steps, x3: engine alive, next run works (app.log quoted)
- [x] DROPPED, no pin change: Committed by path, pushed, CI green
- [x] DROPPED, no pin change: Version 2.1 readiness 8 told: pin, evidence, stamp + notes need refolding
