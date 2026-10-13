# MPI-1126 checklist

- [x] Shared Flow install: lift MpiFlowLibrary._installMissing into js/services/flowInstall.js; the Library calls it
- [x] Renderer: agent.install-flow (quote + start, NO_ENGINE, licence screen note) and agent.install-engine (drives the engine modal); NO_ENGINE on agent.install-model
- [x] Routes: routes/connectorInstall.js (POST /connector/install-flow, /connector/install-engine), mounted in server.js; agentTools.mjs + no-delete allowlist
- [x] MCP: install_model, install_flow, install_engine, each refusing with CONFIRM_DOWNLOAD until the call repeats the size / folder
- [x] Engine modal: listens for engine:install-request { modelsRoot } and runs the Install button's own path
- [x] Tests: tests/mcp.test.cjs (+ flow-licence-surface, agent-no-delete); full suite 3286 pass, 0 fail
- [x] Docs: docs/mcp-server.md, docs/README.md, bridge manifest tool list (0.3.1)
- [x] Live: install_flow voice-changer through MCP on an isolated instance, quote -> confirm -> downloaded -> installed: true -> ALREADY_INSTALLED
- [ ] Live: a REAL first engine install through install_engine (needs a machine or engine root with no ComfyUI; several GB)
