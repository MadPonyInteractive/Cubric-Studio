# MPI-1126 validation

2026-10-13, isolated instance (own profile, own port), MCP called over POST /mcp:

- install_flow voice-changer -> CONFIRM_DOWNLOAD "1 GB"; with confirmDownload "1 GB" -> started; the
  download queue showed `flow:voice-changer` downloading at ~38 MB/s, then done; list_models then
  said installed: true and a second install_flow answered ALREADY_INSTALLED.
- install_flow minimax-music (the Song Flow) -> CONFIRM_DOWNLOAD "13.4 GB" plus the licence-screen note.
  Song is a FREE Flow here, not a paid one.
- install_flow song -> UNKNOWN_FLOW with the paid-Flow errand. install_flow outpaint -> ALREADY_INSTALLED.
- install_model chatterbox -> CONFIRM_DOWNLOAD "5.96 GB". A cloud model (0 GB, installed: false) read
  ALREADY_INSTALLED; fixed to NOTHING_TO_DOWNLOAD (key in Settings), pinned in tests/mcp.test.cjs.
- install_engine on a machine with an engine -> ALREADY_INSTALLED.
- Engine modal, in a playwright page on the same instance with /engine/download stubbed: an agent
  request while the modal is closed waits and runs on show('installing') (set-path + download with
  that folder); while open it runs at once; a request with no modelsRoot (the Settings toggle) and a
  show with no agent request both start nothing.

Real first engine install, 2026-10-13: isolated instance with CUBRIC_ENGINE_ROOT and CUBRIC_MODELS_ROOT on
an empty scratch folder (D:), fresh profile, so the boot gate held the install screen up.
- Found a bug first: install_flow and install_model answered a size, not NO_ENGINE. engineGate.hasNoEngine
  returns false whenever skipLocalEngine is off, trusting the boot gate; an agent arrives WHILE that gate is
  up. Fixed with hasNoEngine({ pastGate: false }) at the two agent call sites (tests/no-engine-gate.test.cjs).
  After the fix both answered NO_ENGINE.
- install_engine -> CONFIRM_DOWNLOAD with the scratch models folder; confirmed -> started 07:29:24. The log
  shows `set-path` first (only the modal Install path calls it), then the ComfyUI archive + 35 universal deps,
  `Engine provisioning complete` 07:38:34 (9 min; 4.8 GB engine, 7.5 GB models).
- Afterwards install_engine -> ALREADY_INSTALLED, install_flow voice-changer -> CONFIRM_DOWNLOAD (engine seen).
- The post-install restart request went to the scratch root's `.engine-restart-request.json`, never the
  user's engine; their ComfyUI kept rendering throughout. Scratch folder deleted after.
- Seen, not ours: 22 x `tar: Cannot connect to D: resolve failed` -> `falling back to extract-zip` (GNU tar
  reads a `D:` path as host:path); every node still extracted.

npm test: 3288 tests, 3286 pass, 0 fail.
