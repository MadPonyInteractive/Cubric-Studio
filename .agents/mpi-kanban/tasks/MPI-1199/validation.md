# MPI-1199 validation

## Root cause

`POST /network-volumes` is not idempotent. RunPod answered Fabio's create (50 GB, EU-RO-1,
2026-10-19) with a 500 after committing the volume. `routes/runpodRemote.js` passed the raw
500 to the renderer, which showed "Volume not created" and never reloaded the list, and the
create logged nothing. A second Create would have billed a duplicate volume.

## Fix

`client.createVolume` snapshots the volume ids before the POST. On a 5xx it re-lists (up to
3 times, 2 s apart) and adopts the volume with the same name + DC that was not there before,
returning it as a 200, so the existing renderer path selects it. A 4xx stays a refusal.
Every create now logs `createVolume REST -> http <status>` (and the body on failure).

## Evidence

- `tests/runpod-volume-create-5xx.test.cjs`: 500 + new volume -> adopted (200, new id);
  500 + no new volume -> stays 500, never adopts the pre-existing one; 400 -> no re-list.
- `npm test`: 3417 pass, 0 fail, 2 skipped. eslint on both files clean.

## Not verified live

RunPod's 500 cannot be triggered on demand, and each try bills a volume. The next real one
shows in `app.log` as `createVolume REST -> http 500` followed by `adopting it`.
