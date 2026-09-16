# MPI-778 validation

## Diagnosis

- `getEngineRoot()` (`routes/platformEngine.js`): `CUBRIC_ENGINE_ROOT` > `CUBRIC_PORTABLE_ROOT/engine` > `.engine-config.json` `enginePath` > `<repo>/engine`. Neither the desktop specs nor `scripts/launch-instance.mjs` sets an override, and this checkout's `.engine-config.json` points at `<repo>/engine`. So the dev app (`npm start`), every desktop spec and every `app:isolated` resolve the same engine root, and the same ComfyUI `input/` and `output/`.
- `main.js` `before-quit` emptied both on every quit. E2E never starts the engine (`Local engine gate skipped`), and a single-instance lock-quit ran the same path.
- The codebase already defines who owns the engine (MPI-484, `routes/comfy.js`): the fork holding `processState.activeComfyProcess`. Stopping the engine was already owner-only. The cleanup ignored that rule. Its server twin `routes/shared.js` `cleanComfyUITempFiles` (called from `server.js` SIGTERM/SIGINT) had the same gap.

## Fix

- `routes/engineScratch.js` `cleanEngineScratch(engineRoot, ownsEngine, logger)` is the one decision. It empties the folders only for the owner.
- `routes/comfy.js` sends `{type:'engine-owner', owned}` to main when the engine is spawned and when it exits.
- `main.js` keeps `engineOwnedHere` from that message and passes it to the helper.
- `routes/shared.js` `cleanComfyUITempFiles` calls the helper with `!!processState.activeComfyProcess`. `server.js` was not touched because a peer has claimed it.

## Evidence (2026-09-16)

- RED before the fix: `tests/desktop/engine-scratch-quit.spec.js` failed. Its app.log shows `Local engine gate skipped` and then `Cleaned temp folder: <scratch>\engine\...\input` and `...\output`. The spec points `CUBRIC_ENGINE_ROOT` at a scratch dir, so no real files were at risk.
- GREEN after the fix: the same spec passed, and its log shows `Engine input/output left alone on quit: this instance did not start the engine`.
- `node --test tests/engine-scratch.test.cjs` passed 2/2 (a non-owner leaves the folders alone; the owner empties them and keeps the dirs).
- The fork's IPC was checked with a scratchpad harness: `routes/comfy` was mounted in a forked child with a scratch engine and node.exe standing in for python. There is no axios, so the 48188 probe was skipped and the user's engine was never contacted. `/comfy/start` sent `owned:true` and `/comfy/stop` sent `owned:false`. PASS.
- `npm test`: 1151 passed, 8 failed. All 8 failures are `tests/llm-describe.test.cjs` / `tests/llm-service.test.cjs` (`BAD_IMAGE` corrupt JPEG fixture). Those are peer MPI-737's uncommitted, claimed files and are unrelated.
- `npm run test:desktop` (private `--output`): 95 passed, 1 failed. The failure was `flow-slide-scroll-reaches-top` (`noSlide`), and that spec passed when rerun alone, so it is flaky under a 10-minute loaded run and unrelated to quit.
- `eslint` on the touched files: clean.

## Residual

- A remote-only instance never owns a local engine, so files that `/comfy/stage-media-data-url` writes locally stay until the next owner quits. They are content-hashed and small.
- Pre-existing, not changed: in `server.js`, `process.on('SIGTERM'|'SIGINT')` is registered after `routes/shared.js`'s own handler, and that handler calls `process.exit()` first. So the server-side cleanup (and `cancelAllDownloads`) never runs.
