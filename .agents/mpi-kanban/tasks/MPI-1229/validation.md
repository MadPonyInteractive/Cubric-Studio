# MPI-1229 validation

## Problem

Follow-up to MPI-1228 (Fabio: "fix the cloud model 0 GB card too", 2026-10-21). A cloud model
(`provider: 'deepinfra'`) with no API key reads `installed: false`, 0 GB missing. Cosmo's
install_model raised "Install X? Download: 0.0 GB"; a Yes reached the app's `_installModel`,
whose dep list is empty for a model with no weights, so it answered ALREADY_INSTALLED - false.
The MCP twin guessed "cloud" from `missingDownloadGb == 0`, which also fits a local model whose
only missing deps are custom nodes (they carry no size), and told that one "add an API key".

## Fix (877938f5c)

- `js/shell/agentDispatch.js` `_listModels`: a cloud model's entry carries `provider`.
  `_installModel`: a keyless cloud model answers NOTHING_TO_DOWNLOAD.
- `services/agentLoop.mjs` install_model: `m.provider` (not installed) -> NOTHING_TO_DOWNLOAD
  "add their API key in Settings", no card.
- `routes/mcp.js` install_model: installed -> ALREADY_INSTALLED, `provider` -> NOTHING_TO_DOWNLOAD,
  else the size (a nodes-only local model now gets CONFIRM_DOWNLOAD).
- `docs/agent-chat.md`, cubric-vision-generate SKILL: `/connector/install` error list.

## Evidence

- `tests/agent-loop.test.cjs` (a) "a cloud model with no key gets NOTHING_TO_DOWNLOAD naming the
  key, and no card"; `tests/mcp.test.cjs` install_model test: `veo-cloud` carries `provider`, new
  `pony` (0 GB, local) gets CONFIRM_DOWNLOAD (old code answered NOTHING_TO_DOWNLOAD).
- `npm run lint` exit 0; `npm test` 3497 pass, 0 fail.
- Not live-tested: Fabio has a DeepInfra key saved, so the keyless case cannot show on his app.
- CI run 39601605307 (head 21140f352, contains 877938f5c): first attempt red on desktop shard 3,
  `llm-settings-remote.spec.js:29`, a spec this diff cannot reach (green locally 4/4). Cause: the
  desktop harness hands over the window before `_bootApp` finishes, so boot's second navigation
  and the 18+ gate close the spec's open dropdown on a slow runner. Re-run of the failed shard:
  all green. Harness fix proposed as its own session.
