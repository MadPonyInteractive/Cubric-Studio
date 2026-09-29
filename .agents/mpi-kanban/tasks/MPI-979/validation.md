# MPI-979 validation

## What happened (2026-09-29, live)

Asked the in-app agent to edit the first frame of a video with Nano Banana 2 Lite. `app.log`:

    [connector] Agent job 2ed94c49-...: generation.submit
    [ERROR] [cloudExecutor] Cloud generation failed (edit / nano-banana-2-lite-cloud): PROVIDER_ERROR - The reference image could not be read.

That message is `routes/deepinfra.js` `_readReference` throwing BEFORE the fetch: nothing reached
DeepInfra, nothing was billed. Reproduced offline: `_readReference(<an .mp4>)` throws
`Input buffer contains unsupported image format`.

## Root cause

`resolveAgentMedia` (`js/data/generationControls.js`) gave every ref the SLOT's `mediaType` and
never checked what the ref was. The agent's `generate` takes any allowlisted ref, a video
included, so the video card went into the edit's `inputImage` slot as "an image". Every agent
path goes through this one resolver (in-app agent, MCP, HTTP connector).

## Fix (772e9baf1)

The resolver reads the ref's type off its file name and refuses a contradiction with
`BAD_REQUEST`. A video in a picture slot tells the agent there is no frame-grab tool and to ask
the user for the video viewer's right-click "Create snapshot", which lands the frame as a picture
card. A GIF and a name with no extension are not judged (pass as before).

## Evidence

- `tests/agent-generation-relay.test.cjs` "a video ref in a picture slot is refused..." - mp4 and
  wav refused, png / gif / no-extension pass.
- Every test file that loads `generationControls`, `routes/connector` or `agentDispatch`
  (24 files): 435 pass, 0 fail, 1 skipped. eslint clean.
- Not run live in the app: the refusal is renderer-side and fires before any engine or cloud call,
  and the test calls the same function `agentDispatch._submitGeneration` calls.

## Follow-ups (filed 2026-09-29, Fabio said yes to both)

- MPI-980: a video sent as a picture goes as its first frame (sidecar start frame, else frame 0).
- MPI-981: the cloud error dialog shows the route's own reason instead of the fixed provider copy.
