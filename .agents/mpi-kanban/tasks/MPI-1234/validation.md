# MPI-1234 validation

## What Fabio saw (2026-10-21, "Flux 3 tests", Cosmo on Ollama, DeepInfra key removed)

"It's Flux schnell" -> install_model got NOTHING_TO_DOWNLOAD (MPI-1229, no card: pass), then generate
on `flux-schnell-cloud` was refused OP_UNAVAILABLE "unsupported, or its weights are not installed"
plus the installed FLUX kin. The agent read `app:runpod-setup` twice and ran FLUX.3 Klein t2i
(log 14:43:32). The refusal named a cause a cloud model cannot have.

## Fix

`js/shell/agentDispatch.js` `opUnavailable(model, operation)`: a cloud model whose key is missing
(`model.provider && !isOperationInstalled(model, null)`, the MPI-1229 predicate) answers "runs in
the cloud on the user's own API key, none is set, nothing to install, tell them". Both model call
sites use it (`buildGeneration` pinned + unpinned, `openPrompt`). The installed-kin hint stays on
the unpinned refusal (routing policy unchanged).

## Evidence

- `node --test tests/agent-installed-kin.test.cjs` 3/3, incl. keyless -> key reason, keyed + bad
  op -> old reason (stubbed key through the real secretsClient door).
- `npm run lint` 0, `npm test` 3498 pass / 0 fail.
