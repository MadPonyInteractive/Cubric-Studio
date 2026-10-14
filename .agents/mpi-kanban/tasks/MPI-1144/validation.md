# MPI-1144 validation

- 2026-10-14: root cause in brief.md. Fix direction chosen: single clean at engine spawn.
- 2026-10-14: fixed in 2c0ab6741. /comfy/start runs cleanEngineScratch(ENGINE_ROOT, logger) right before spawn; quit-time cleans gone from main.js before-quit and routes/shared.js installShutdown, with the engine-owner IPC (main.js engineOwnedHere, comfy.js _reportEngineOwnership) that only fed them. A locked entry warns and stays until the next start.
- Proof: npm test 3317 pass / 0 fail (tests/engine-scratch.test.cjs: empties + keeps folders, a simulated EPERM entry warns and the rest still goes, a source check that nothing quit-side calls the cleaner and the start does before spawn; tests/fork-shutdown.test.cjs now asserts the staged input survives SIGTERM/SIGINT). tests/desktop/engine-scratch-quit.spec.js passes. eslint clean.
- Not proven end-to-end: E2E never starts a local engine, so the original EPERM (a live engine holding a staged file at quit) cannot be replayed in an isolated app. Fabio's next quit after a local Flow is the live check.
- Changed from the brief: the scratch now stays on disk between sessions until the next local engine start (was: emptied on quit).
