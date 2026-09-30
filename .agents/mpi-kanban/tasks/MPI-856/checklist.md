# MPI-856 checklist

- [x] Audit: what needs the engine, what runs on cloud or no engine at all (plan.md § Audit)
- [x] Hard net in `ensureServerRunning` + `no_engine` handled at the three `runWorkflow` catch sites
- [x] Doors: project create/open ungated, Model Library opens, `flow:open` gated
- [x] History rails dim the engine-only tools with the reason
- [x] Enhance and Describe fall to the endpoint backend with no engine
- [x] Model Library installs and Settings Restart engine refuse with the named warning
- [x] Warning copy names cloud models
- [x] Unit test for the net (5/5); `npm test` green apart from a live peer's 2 Ollama tests
- [x] Desktop spec with an empty engine root (`tests/desktop/no-engine-user.spec.js`), proven red without the net
- [x] `UNRELEASED.md` line; docs (`cloud-generation.md`, `shell.md`, `agent/runpod-setup.md`)
- [x] Fabio's look: "1" (2026-09-30), incl. a cloud image + a cloud video with no engine
- [x] No-models popup points at the DeepInfra key (found in his look, round 1)
- [x] "Remote only" card names DeepInfra (his call)
