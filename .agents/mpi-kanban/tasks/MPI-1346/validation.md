# MPI-1346 validation

- tests/model-priority.test.cjs + agent-bench/tiles/flux3 tests: 46 pass, 0 fail.
- npm run lint clean. npm test: 3800 pass, 2 fail, both the Video Edit Flow tests from another session's uncommitted comfy_workflows/flow_video_edit.json (MPI-1335), not this change.
- Live model check, 2026-10-29: scratch agent-test (real loop, DeepSeek-V4-Flash-0731, fake tools), Klein 9B + Qwen-Image 2.1 installed, Krea 2 / FLUX.3 / MOSS not. 2 cases x 3 runs, $0.0125.
  - photo of a demon on fire: 3/3 qwen-image-2-1 t2i, no install_model call.
  - same framing as a video frame, demon on fire: 3/3 no install card; i2i on klein-9b 2/3, qwen-image-2-1 1/3.
- Commit e9b767005.
