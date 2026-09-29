# MPI-981 validation

## Bug

`js/services/cloudExecutor.js` `cloudErrorMessage` returned `ERROR_COPY[code]` before the route's
message, so every `PROVIDER_ERROR` showed "The provider could not complete this generation. Failed
calls are not billed." Live 2026-09-29 (MPI-979) the real reason was the app's own: "The reference
image could not be read.", before anything was sent. The agent was told the same wrong reason
(`userMessage`). It was also false for "The result was generated but could not be downloaded.",
which is billed.

## Fix (d61edd2ad)

- A `PROVIDER_ERROR` with a route message shows that message. A bare one (upstream HTTP failure,
  `_fail(res, code, null)`) keeps the fixed provider copy. Every other code keeps its copy.
- `routes/deepinfra.js`: the failures before the POST now end "Nothing was sent, so nothing was
  billed." (no cloud model, no reference arrived, reference(s) unreadable); "DeepInfra could not be
  reached, so nothing was billed." The two after-billing messages make no billing claim.

## Evidence

- `tests/cloud-executor.test.cjs` "a provider error the route explained shows its reason, not the
  blanket copy (MPI-981)"; the existing "names a non-billing cause" and unknown-code tests still
  pass. cloud-executor + every deepinfra test file: 67 pass, 0 fail. eslint clean.

## Known edge, left

A fetch that rejects (the app's own server not answering) passes its JS error text ("Failed to
fetch") as the message, so the dialog now shows that instead of the provider sentence. Only when
the local server is down.
