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

Not run: a real first engine install end to end (several GB onto a machine with no ComfyUI).

npm test: 3288 tests, 3286 pass, 0 fail.
