# MPI-824 — checklist

Fabio asked for the complete fix (all three parts), 2026-09-19.

## 1 — Re-resolve by label (survives GUID churn)

- [x] `AUDIO_OUTPUT_DEVICE` stores `{ deviceId, label }`; a pre-MPI-824 bare string migrates
- [x] On `NotFoundError`, look up the current id of a device with the stored label, apply it, and re-pin the store
- [x] One re-resolve attempt per dead id, not one per `play` — `applySink` runs on every playback

## 2 — Re-apply on `devicechange` (survives late registration)

- [x] `installAudioOutput` listens for `devicechange` and re-applies to live elements
- [x] The attempt cache clears on `devicechange`, so a device that comes back is retried
- [x] The warn-once set does NOT clear — a churning mixer must not produce a stream of warnings

## 3 — Say so, instead of silently reverting

- [x] Settings lists a stored-but-missing device as its own option (`meta: 'Not available'`) rather than falling through to the placeholder
- [x] An inline note on the Output row says playback is on the system default until it returns
- [x] The meta carries `icon: 'warning'` so it renders as a FLAG — a plain meta ellipsises at 11 chars (MPI-599) and "Not available" is 13

## Verification

- [x] `tests/audio-output.test.cjs` covers heal-by-label, the one-attempt-per-id guard, the `devicechange` re-apply, and the legacy-string migration — 9 cases green
- [x] `tests/desktop/audio-output-missing-device.spec.js` reads the REAL rendered panel on a real Electron shell
- [x] Proven RED on pre-fix code — unit `pass 5, fail 4`; the spec fails with `Expected "SteelSeries Sonar - Media", Received "System default"`, which is the bug report verbatim
- [x] `npm test` green — 1415 tests, 1414 pass, 0 fail, 1 skipped
- [x] `npx eslint` clean over all five changed files
