# MPI-1206 Validation

## Reproduced (2026-10-19, 2.1.1 update test, install D:\CVTest\CubricVision-v1.5.0-to-v2.1.1d, build 17f8dbf25a0b)
- App moved its own engine 0.34.0 -> 0.42.1 at launch (one upgrade, 7 node deps repaired, 18:42:19.9Z).
- 18:42:20.465Z and 18:42:21.643Z: two `Starting ComfyUI background process...`, two curated pip passes on one site-packages.
- 18:42:56.8Z: one pip died, `[WinError 32] The process cannot access the file because it is being used by another process`; it wrote `.cubric_python_deps_failed`. The other stamped the success marker at 18:44:01 but never cleared the failure file.
- Second ComfyUI spawn: `Port 48188 is already in use`. `/comfy/status` kept `depsWarning: "Pip command failed with code 1"`; the first `/connector/generate` answered `python_deps_broken`.
- A relaunch cleared it (`ensureCuratedPythonDeps` removes the failure file on entry, marker matched): `depsWarning: null`, SDXL t2i rendered in 87 s, image matches the prompt.

## Fix
- `routes/comfy.js`: `/comfy/start` runs through `_oneStartAtATime`; a call made while a start is in flight waits for it, then takes the "Already running" answer.
- `tests/comfy-start-single-flight.test.cjs`: three overlapping starts run strictly one after another (peak 1); the route is wired through the guard.
- Related start tests 33/33; `npm test` 3424 pass / 0 fail.

## CI
- Tests run 39306413245 on d20daa9c3: first attempt failed one unrelated test (`cancel stops a running upload...`, fetch ECONNRESET in tests/remote-uploads.test.cjs); `--failed` re-run: unit + desktop (1-4) all success.

## App-level proof (2026-10-19, build b60ed53033cc, install D:\CVTest\CubricVision-v1.5.0-to-v2.1.1e)
- One in-place engine upgrade at launch, 0.34.0 -> 0.42.1.
- 20:07:12.769Z one `Starting ComfyUI background process...` + one curated pip pass; the client's `Requesting ComfyUI server start` at 20:07:22 waited for it and spawned nothing.
- Marker stamped 20:08:29, no WinError, no "degraded"; `/comfy/status` depsWarning null.
- First-launch SDXL t2i rendered in 72 s, image matches the prompt.

## Noticed
- The first start (20:07:12) is logged without the client's `Requesting ComfyUI server start` line, so a second caller exists outside comfyController's ensureServerRunning. Harmless now that the route allows one start at a time.
